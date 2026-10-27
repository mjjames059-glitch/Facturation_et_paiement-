import Link from "next/link";
import InvoiceActions from "@/components/invoice-actions";
import ContactPanel from "@/components/contact-panel";
import { formatMinorAmount, type CurrencyCode } from "@/lib/money";

export type DashboardLateInvoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientPhone: string;
  amountDue: string;
  currency: CurrencyCode;
  dueDate: string;
  token: string;
};

function frenchDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DashboardScreen({
  companyName,
  billed,
  collected,
  outstanding,
  overduePercent,
  pendingPercent,
  paidPercent,
  breakdown,
  clientsCount,
  lateInvoices,
  today,
  exchangeRate,
  loadError,
  role,
}: {
  companyName: string;
  billed: string;
  collected: string;
  outstanding: string;
  overduePercent: number;
  pendingPercent: number;
  paidPercent: number;
  breakdown: { b2b: string; b2a: string; b2c: string };
  clientsCount: number;
  lateInvoices: DashboardLateInvoice[];
  today: string;
  exchangeRate: string;
  loadError: boolean;
  role: string;
}) {
  return (
    <div className="workspace-wrap">
      <h1>Bonjour {companyName}</h1>
      <p className="lead">Voici l’état de vos encaissements.</p>
      {loadError && <p className="auth-error" role="alert">Certaines données n’ont pas pu être chargées. Vérifiez les migrations Supabase.</p>}
      <div className="stats">
        <div className="stat big"><b>{formatMinorAmount(outstanding, "USD")}</b><span>Reste à encaisser</span></div>
        <div className="stat"><b>{formatMinorAmount(billed, "USD")}</b><span>Total facturé</span></div>
        <div className="stat"><b>{formatMinorAmount(collected, "USD")}</b><span>Déjà encaissé</span></div>
      </div>
      {billed === "0" && role !== "viewer" && <section className="panel empty-state">
        <div><p className="eyebrow">Premiers pas</p><h2>Votre activité commence ici</h2><p className="muted">{clientsCount === 0 ? "Ajoutez votre premier client pour pouvoir créer une facture." : "Créez votre première facture pour suivre les montants à encaisser."}</p></div>
        <Link className="button primary" href={clientsCount === 0 ? "/clients" : "/factures/nouvelle"}>{clientsCount === 0 ? "Ajouter un client" : "Créer une facture"}</Link>
      </section>}
      <section className="panel">
        <h2>Répartition des montants facturés</h2>
        {billed === "0" ? <p className="empty">La répartition apparaîtra après votre première facture.</p> : <div className="bar" role="img" aria-label={`Payé ${paidPercent} %, en attente ${pendingPercent} %, en retard ${overduePercent} %`}>
          <i aria-hidden="true" className="bar-paid" style={{ width: `${paidPercent}%` }} />
          <i aria-hidden="true" className="bar-pending" style={{ width: `${pendingPercent}%` }} />
          <i aria-hidden="true" className="bar-late" style={{ width: `${overduePercent}%` }} />
        </div>}
        {billed !== "0" && <p className="note">Vert : payé · Jaune : en attente · Rouge : en retard</p>}
      </section>
      <div className="stats breakdown">
        <div className="stat"><b>{formatMinorAmount(breakdown.b2b, "USD")}</b><span>Entreprises (B2B)</span></div>
        <div className="stat"><b>{formatMinorAmount(breakdown.b2a, "USD")}</b><span>Administrations (B2A)</span></div>
        <div className="stat"><b>{formatMinorAmount(breakdown.b2c, "USD")}</b><span>Particuliers (B2C)</span></div>
      </div>
      <section className="panel">
        <div className="section-title-row"><h2>À relancer en priorité</h2><Link href="/factures">Toutes les factures</Link></div>
        {lateInvoices.length === 0 ? <p className="empty">Aucun retard. Bravo !</p> : <div className="scroll"><table className="invoice-table"><thead><tr><th>N°</th><th>Client</th><th>Échéance</th><th className="right">Reste dû</th><th>Relance</th></tr></thead><tbody>
          {lateInvoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoiceNumber}</td><td>{invoice.clientName}</td><td>{frenchDate(invoice.dueDate)}</td><td className="right">{formatMinorAmount(invoice.amountDue, invoice.currency)}</td><td><InvoiceActions invoiceId={invoice.id} status="overdue" today={today} token={invoice.token} clientName={invoice.clientName} clientPhone={invoice.clientPhone} invoiceNumber={invoice.invoiceNumber} amountText={formatMinorAmount(invoice.amountDue, invoice.currency)} reminderAmountText={formatMinorAmount(invoice.amountDue, invoice.currency)} reminderOnly role={role} /></td></tr>)}
        </tbody></table></div>}
      </section>
      <p className="settings-rate">Taux de conversion : 1 USD = {exchangeRate} CDF · <Link href="/parametres">Modifier dans les paramètres</Link></p>
      <ContactPanel />
    </div>
  );
}
