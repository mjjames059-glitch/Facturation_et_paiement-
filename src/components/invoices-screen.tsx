"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import InvoiceActions from "@/components/invoice-actions";
import { formatMinorAmount, type CurrencyCode } from "@/lib/money";

export type InvoiceSummary = {
  id: string;
  client_id: string;
  invoice_number: string;
  currency: CurrencyCode;
  issued_at: string;
  due_date: string;
  total_amount: string | number;
  paid_amount: string | number;
  effective_status: "draft" | "sent" | "paid" | "overdue";
  public_token: string;
};

const statusLabels = { draft: "Brouillon", sent: "Envoyée", paid: "Payée", overdue: "En retard" };
const statusClasses = { draft: "tag-brouillon", sent: "tag-envoyée", paid: "tag-payée", overdue: "tag-en-retard" };

function frenchDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoicesScreen({
  invoices,
  clientNames,
  clientPhones,
  today,
  loadError,
}: {
  invoices: InvoiceSummary[];
  clientNames: Record<string, string>;
  clientPhones: Record<string, string>;
  today: string;
  loadError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
    return invoices.filter((invoice) => {
      const matchesQuery = !normalizedQuery || `${invoice.invoice_number} ${clientNames[invoice.client_id] ?? ""}`.toLocaleLowerCase("fr-FR").includes(normalizedQuery);
      return matchesQuery && (statusFilter === "all" || invoice.effective_status === statusFilter);
    });
  }, [clientNames, invoices, query, statusFilter]);

  return (
    <div className="workspace-wrap">
      <div className="page-title-row"><div><h1>Factures</h1><p className="lead">Toutes vos factures et leur statut.</p></div><Link className="button primary" href="/factures/nouvelle">Nouvelle facture</Link></div>
      <div className="invoice-filters">
        <div><label htmlFor="invoice-search">Rechercher une facture</label><input id="invoice-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="N° de facture ou nom du client" /></div>
        <div><label htmlFor="invoice-status">Filtrer par statut</label><select id="invoice-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tous les statuts</option><option value="draft">Brouillons</option><option value="sent">Envoyées</option><option value="paid">Payées</option><option value="overdue">En retard</option></select></div>
        <p className="filter-count" role="status" aria-live="polite">{filteredInvoices.length} facture{filteredInvoices.length === 1 ? "" : "s"}</p>
      </div>
      <section className="panel">
        {loadError && <p className="auth-error" role="alert">Impossible de charger les factures. Vérifiez que les migrations Supabase sont appliquées.</p>}
        {invoices.length === 0 ? <p className="empty">Aucune facture pour l’instant. Créez votre première facture en une minute.</p> : filteredInvoices.length === 0 ? <div className="empty-filter"><p className="empty">Aucune facture ne correspond à votre recherche.</p><button className="button small" type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Effacer les filtres</button></div> : (
          <div className="scroll"><table className="invoice-table"><thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Échéance</th><th className="right">Montant</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{filteredInvoices.map((invoice) => <tr key={invoice.id}>
              <td>{invoice.invoice_number}</td><td>{clientNames[invoice.client_id] ?? "Client"}</td>
              <td>{frenchDate(invoice.issued_at)}</td><td>{frenchDate(invoice.due_date)}</td>
              <td className="right">{formatMinorAmount(invoice.total_amount, invoice.currency)}</td>
              <td><span className={`tag ${statusClasses[invoice.effective_status]}`}>{statusLabels[invoice.effective_status]}</span></td>
              <td><InvoiceActions invoiceId={invoice.id} status={invoice.effective_status} today={today} token={invoice.public_token} clientName={clientNames[invoice.client_id] ?? "client"} clientPhone={clientPhones[invoice.client_id] ?? ""} invoiceNumber={invoice.invoice_number} amountText={formatMinorAmount(invoice.total_amount, invoice.currency)} reminderAmountText={formatMinorAmount(BigInt(invoice.total_amount) - BigInt(invoice.paid_amount), invoice.currency)} /></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
