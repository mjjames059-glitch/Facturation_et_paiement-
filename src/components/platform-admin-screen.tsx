"use client";

import { useActionState } from "react";
import { changeCompanySubscriptionAction, type PlatformAdminActionState } from "@/app/actions/platform-admin";

export type PlatformCompany = {
  company_id: string;
  company_name: string;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  plan_id: string | null;
  plan_name: string | null;
  subscription_status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | null;
  current_period_end: string | null;
  member_count: number;
  client_count: number;
  invoice_count: number;
};

export type PlatformPlan = { id: string; name: string };
export type PlatformAuditEvent = {
  id: string;
  actor_email: string | null;
  company_id: string | null;
  action: string;
  entity_type: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  created_at: string;
};

const statuses = [
  ["trialing", "Essai"],
  ["active", "Actif"],
  ["past_due", "En retard"],
  ["canceled", "Annulé"],
  ["incomplete", "Incomplet"],
] as const;

const initialState: PlatformAdminActionState = {};

function SubscriptionForm({ company, plans }: { company: PlatformCompany; plans: PlatformPlan[] }) {
  const [state, formAction, pending] = useActionState(changeCompanySubscriptionAction, initialState);
  return (
    <form action={formAction} className="platform-subscription-form">
      <input type="hidden" name="company_id" value={company.company_id} />
      <select aria-label={`Forfait de ${company.company_name}`} name="plan_id" defaultValue={company.plan_id ?? plans[0]?.id} required>
        {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select>
      <select aria-label={`Statut de ${company.company_name}`} name="status" defaultValue={company.subscription_status ?? "incomplete"} required>
        {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button className="button small" disabled={pending}>{pending ? "…" : "Enregistrer"}</button>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
    </form>
  );
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("fr-CD", { dateStyle: "medium" });
}

export default function PlatformAdminScreen({
  companies,
  plans,
  auditEvents,
  search,
  status,
  planId,
  page,
  hasMore,
}: {
  companies: PlatformCompany[];
  plans: PlatformPlan[];
  auditEvents: PlatformAuditEvent[];
  search: string;
  status: string;
  planId: string;
  page: number;
  hasMore: boolean;
}) {
  return (
    <main className="platform-admin-wrap">
      <header className="platform-admin-heading">
        <div><h1>Administration Facturo</h1>
          <p>Gestion des entreprises clientes et des abonnements. Les modifications sont consignées.</p>
        </div>
      </header>
      <section className="panel">
        <h2>Entreprises clientes</h2>
        <form method="get" className="platform-company-filters">
          <div><label htmlFor="company-search">Recherche</label><input id="company-search" name="q" maxLength={120} defaultValue={search} placeholder="Entreprise ou e-mail du propriétaire" /></div>
          <div><label htmlFor="subscription-filter">Statut</label><select id="subscription-filter" name="status" defaultValue={status}><option value="">Tous les statuts</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div><label htmlFor="plan-filter">Forfait</label><select id="plan-filter" name="plan" defaultValue={planId}><option value="">Tous les forfaits</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div>
          <input type="hidden" name="page" value="0" />
          <button className="button primary">Filtrer</button>
        </form>
        {companies.length === 0 ? <p className="empty">Aucune entreprise ne correspond à ces filtres.</p> : <div className="scroll">
          <table className="platform-company-table">
            <thead><tr><th>Entreprise</th><th>Propriétaire / contact</th><th>Créée le</th><th>Usage</th><th>Abonnement</th></tr></thead>
            <tbody>{companies.map((company) => <tr key={company.company_id}>
              <td><strong>{company.company_name}</strong><small>{company.company_id}</small></td>
              <td>{company.owner_name || "—"}<small>{company.owner_email || "Contact indisponible"}</small></td>
              <td>{dateLabel(company.created_at)}</td>
              <td>{company.member_count} membres · {company.client_count} clients · {company.invoice_count} factures</td>
              <td><SubscriptionForm company={company} plans={plans} /></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="platform-pagination">
          {page > 0 && <a className="button small" href={`?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&plan=${encodeURIComponent(planId)}&page=${page - 1}`}>Précédent</a>}
          <span>Page {page + 1}</span>
          {hasMore && <a className="button small" href={`?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&plan=${encodeURIComponent(planId)}&page=${page + 1}`}>Suivant</a>}
        </div>
      </section>
      <section className="panel">
        <h2>Journal d’audit récent</h2>
        {auditEvents.length === 0 ? <p className="empty">Aucune modification administrative enregistrée.</p> : <div className="scroll">
          <table className="platform-audit-table">
            <thead><tr><th>Date</th><th>Administrateur</th><th>Action</th><th>Entreprise</th><th>Avant → après</th></tr></thead>
            <tbody>{auditEvents.map((event) => <tr key={event.id}>
              <td>{dateLabel(event.created_at)}</td>
              <td>{event.actor_email || "Compte supprimé"}</td>
              <td>{event.action}</td>
              <td>{event.company_id || "—"}</td>
              <td><code>{JSON.stringify(event.before_data)} → {JSON.stringify(event.after_data)}</code></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
    </main>
  );
}
