import Link from "next/link";
import InvoiceActions from "@/components/invoice-actions";
import { ContactPanel } from "@/components/site-links";
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

export type DashboardRecentActivity = {
  id: string;
  type: "invoice" | "payment";
  title: string;
  subtitle: string;
  amount: string;
  date: string;
  status: "draft" | "sent" | "paid" | "overdue";
  currency: CurrencyCode;
};

export type DashboardTrendPoint = {
  key: string;
  label: string;
  total: string;
  paid: string;
};

function frenchDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function activityLabel(status: DashboardRecentActivity["status"]): string {
  if (status === "paid") return "Payée";
  if (status === "overdue") return "En retard";
  if (status === "sent") return "Envoyée";
  return "Brouillon";
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
  invoiceCount,
  paidInvoices,
  unpaidInvoices,
  overdueInvoices,
  lateOutstanding,
  today,
  exchangeRate,
  loadError,
  role,
  trend,
  recentActivity,
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
  invoiceCount: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  lateOutstanding: string;
  today: string;
  exchangeRate: string;
  loadError: boolean;
  role: string;
  trend: DashboardTrendPoint[];
  recentActivity: DashboardRecentActivity[];
}) {
  const trendMax = trend.reduce((max, value) => {
    const candidate = BigInt(value.total || "0");
    return candidate > max ? candidate : max;
  }, BigInt(1));

  return (
    <div className="workspace-wrap dashboard-shell">
      <div className="page-title-row">
        <div>
          <h1>Bonjour {companyName}</h1>
          <p className="lead">Suivi financier et encaissement en temps réel.</p>
        </div>
        <div className="metric-inline">
          <span className="eyebrow">Taux de conversion</span>
          <strong>1 USD = {exchangeRate} CDF</strong>
        </div>
      </div>

      {loadError && <p className="auth-error" role="alert">Certaines données n’ont pas pu être chargées. Vérifiez les migrations Supabase.</p>}

      <div className="dashboard-metrics">
        <div className="stat big">
          <span className="metric-label">Reste à encaisser</span>
          <b>{formatMinorAmount(outstanding, "USD")}</b>
          <small>{lateInvoices.length} facture{lateInvoices.length <= 1 ? "" : "s"} en retard</small>
        </div>
        <div className="stat">
          <span className="metric-label">Total facturé</span>
          <b>{formatMinorAmount(billed, "USD")}</b>
          <small>{invoiceCount} facture{invoiceCount <= 1 ? "" : "s"} émises</small>
        </div>
        <div className="stat">
          <span className="metric-label">Déjà encaissé</span>
          <b>{formatMinorAmount(collected, "USD")}</b>
          <small>{paidInvoices} payée{paidInvoices <= 1 ? "" : "s"}</small>
        </div>
        <div className="stat">
          <span className="metric-label">Factures à traiter</span>
          <b>{unpaidInvoices}</b>
          <small>{overdueInvoices} en retard</small>
        </div>
      </div>

      {billed === "0" && role !== "viewer" && <section className="panel empty-state">
        <div><p className="eyebrow">Premiers pas</p><h2>Votre activité commence ici</h2><p className="muted">{clientsCount === 0 ? "Ajoutez votre premier client pour pouvoir créer une facture." : "Créez votre première facture pour suivre les montants à encaisser."}</p></div>
        <Link className="button primary" href={clientsCount === 0 ? "/clients" : "/factures/nouvelle"}>{clientsCount === 0 ? "Ajouter un client" : "Créer une facture"}</Link>
      </section>}

      <section className="panel dashboard-overview">
        <div className="section-header">
          <h2>Performance globale</h2>
          <span className="eyebrow">Paiement / attente / retard</span>
        </div>
        {billed === "0" ? <p className="empty">La répartition apparaîtra après votre première facture.</p> : <>
          <div className="distribution-wrap">
            <div className="bar" role="img" aria-label={`Payé ${paidPercent} %, en attente ${pendingPercent} %, en retard ${overduePercent} %`}>
              <i aria-hidden="true" className="bar-paid" style={{ width: `${paidPercent}%` }} />
              <i aria-hidden="true" className="bar-pending" style={{ width: `${pendingPercent}%` }} />
              <i aria-hidden="true" className="bar-late" style={{ width: `${overduePercent}%` }} />
            </div>
            <div className="distribution-legend">
              <span><i className="legend-swatch legend-paid" />Payé</span>
              <span><i className="legend-swatch legend-pending" />En attente</span>
              <span><i className="legend-swatch legend-late" />En retard</span>
            </div>
          </div>
          <div className="dashboard-summary-row">
            <div><strong>{formatMinorAmount(collected, "USD")}</strong><small>encaissé</small></div>
            <div><strong>{formatMinorAmount(outstanding, "USD")}</strong><small>à recevoir</small></div>
            <div><strong>{formatMinorAmount(lateOutstanding, "USD")}</strong><small>retards</small></div>
          </div>
        </>}
      </section>

      <div className="dashboard-row">
        <section className="panel">
          <h2>Évolution des paiements</h2>
          <div className="trend-chart" aria-label="Évolution mensuelle des paiements et facturations">
            {trend.map((point) => {
              const totalValue = BigInt(point.total || "0");
              const paidValue = BigInt(point.paid || "0");
              const totalHeight = totalValue === BigInt(0) ? 0 : Number((totalValue * 100n) / trendMax);
              const paidHeight = totalValue === BigInt(0) ? 0 : Number((paidValue * 100n) / (totalValue === BigInt(0) ? 1n : totalValue));
              const totalBarHeight = totalValue === BigInt(0) ? 0 : Math.max(6, Math.min(100, totalHeight));
              const paidBarHeight = paidValue === BigInt(0) ? 0 : Math.max(6, Math.min(100, paidHeight));
              return (
                <div key={point.key} className="trend-column">
                  <strong>{formatMinorAmount(point.total, "USD")}</strong>
                  <div className="trend-bars" aria-hidden="true">
                    <span className="trend-total" style={{ height: `${totalBarHeight}%` }} />
                    <span className="trend-paid" style={{ height: `${paidBarHeight}%` }} />
                  </div>
                  <small>{point.label}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <h2>Activité récente</h2>
          <ul className="activity-list">
            {recentActivity.length === 0 ? <li className="empty">Aucune activité récente pour le moment.</li> : recentActivity.map((item) => (
              <li key={item.id} className="activity-item">
                <div className="activity-content">
                  <div className="activity-line"><strong>{item.title}</strong><span className={`tag ${item.type === "payment" ? "tag-payée" : item.status === "overdue" ? "tag-en-retard" : item.status === "sent" ? "tag-envoyée" : "tag-brouillon"}`}>{item.type === "payment" ? "Paiement" : activityLabel(item.status)}</span></div>
                  <small>{item.subtitle}</small>
                  <small>{new Date(`${item.date}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</small>
                </div>
                <div className="activity-amount">
                  <strong>{item.type === "payment" ? "+" : ""}{formatMinorAmount(item.amount, item.currency)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

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
      <ContactPanel variant="dashboard" />
    </div>
  );
}
