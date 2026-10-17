import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadPublicInvoice } from "@/lib/public-invoice";
import { formatMinorAmount } from "@/lib/money";
import { getCompanyLogoUrl } from "@/lib/supabase/storage";

const statusLabels = { sent: "Envoyée", paid: "Payée", overdue: "En retard" };
type PublicPageProps = { params: Promise<{ token: string }> };

function frenchDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

async function PublicInvoiceContent({ params }: PublicPageProps) {
  const { token } = await params;
  const data = await loadPublicInvoice(token);
  if (!data) notFound();
  const { invoice, company, client, lines } = data;

  return (
    <main className="public-shell">
      <article className="public-invoice">
        <header className="public-header"><div className="public-brand">{getCompanyLogoUrl(company.logo_path) ? <div className="public-logo" role="img" aria-label={company.company_name} style={{ backgroundImage: `url("${getCompanyLogoUrl(company.logo_path)}")` }} /> : <Link href="/" className="brand">Facturo<small>Document commercial</small></Link>}<b>{company.company_name}</b></div><span className="public-status">{statusLabels[invoice.effective_status]}</span></header>
        <h1>Facture {invoice.invoice_number}</h1>
        <div className="public-details">
          <section><h2>Émetteur</h2><b>{company.company_name}</b>{company.address && <p>{company.address}</p>}{company.phone && <p>{company.phone}</p>}{company.rccm && <p>RCCM : {company.rccm}</p>}{company.nif && <p>NIF : {company.nif}</p>}</section>
          <section><h2>Facturée à</h2><b>{client.name}</b>{client.address && <p>{client.address}</p>}{client.nif && <p>NIF : {client.nif}</p>}</section>
          <section><h2>Dates</h2><p>Émise le {frenchDate(invoice.issued_at)}</p><p>Échéance le {frenchDate(invoice.due_date)}</p>{invoice.order_reference && <p>Marché / bon de commande : {invoice.order_reference}</p>}</section>
        </div>
        <div className="scroll"><table className="public-lines"><thead><tr><th>Description</th><th>Quantité</th><th className="right">Prix unitaire</th><th className="right">Montant</th></tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.description}-${index}`}><td>{line.description} · {line.unit}</td><td>{line.quantity.replace(".", ",")}</td><td className="right">{formatMinorAmount(line.unit_price, invoice.currency)}</td><td className="right">{formatMinorAmount(line.line_total, invoice.currency)}</td></tr>)}</tbody></table></div>
        <div className="public-total"><span>Total à régler</span><b>{formatMinorAmount(invoice.total_amount, invoice.currency)}</b></div>
        <p className="public-note">Document commercial, non certifié par la DGI.</p>
        <div className="actions"><a className="button primary" href={`/f/${token}/pdf`}>Télécharger le PDF</a></div>
      </article>
    </main>
  );
}

export default function PublicInvoicePage({ params }: PublicPageProps) {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement de la facture…</p></main>}><PublicInvoiceContent params={params} /></Suspense>;
}
