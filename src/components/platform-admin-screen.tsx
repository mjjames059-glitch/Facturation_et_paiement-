"use client";

import { useActionState } from "react";
import {
  changeCompanySubscriptionAction,
  recordSubscriptionPaymentAction,
  updateSubscriptionPlanLimitsAction,
  type PlatformAdminActionState,
} from "@/app/actions/platform-admin";

export type PlatformCompany = {
  company_id: string;
  company_name: string;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  plan_id: string | null;
  plan_name: string | null;
  subscription_status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "suspended" | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  last_payment_at: string | null;
  last_payment_reference: string | null;
  max_daily_invoices: number | null;
  invoices_today: number;
  member_count: number;
  client_count: number;
  invoice_count: number;
};

export type PlatformPlan = {
  id: string;
  name: string;
  is_active: boolean;
  max_members: number | null;
  max_clients: number | null;
  max_catalog_items: number | null;
  max_monthly_invoices: number | null;
  max_daily_invoices: number | null;
};
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
  ["suspended", "Suspendu"],
] as const;

const initialState: PlatformAdminActionState = {};

function dateInputValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function dateLabel(value: string | null) {
  if (!value) return "Non définie";
  return new Date(value).toLocaleDateString("fr-CD", { dateStyle: "medium", timeZone: "UTC" });
}

function SubscriptionForm({ company, plans }: { company: PlatformCompany; plans: PlatformPlan[] }) {
  const [state, formAction, pending] = useActionState(changeCompanySubscriptionAction, initialState);
  return (
    <form action={formAction} className="platform-subscription-form">
      <input type="hidden" name="company_id" value={company.company_id} />
      <label>Forfait
        <select aria-label={`Forfait de ${company.company_name}`} name="plan_id" defaultValue={company.plan_id ?? plans.find((plan) => plan.is_active)?.id} required>
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.is_active ? "" : " (inactif)"}</option>)}
        </select>
      </label>
      <label>Statut
        <select aria-label={`Statut de ${company.company_name}`} name="status" defaultValue={company.subscription_status ?? "incomplete"} required>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Fin de période payée
        <input aria-label={`Fin de période payée de ${company.company_name}`} type="date" name="current_period_end" defaultValue={dateInputValue(company.current_period_end)} />
      </label>
      <label>Fin d’essai
        <input aria-label={`Fin d’essai de ${company.company_name}`} type="date" name="trial_ends_at" defaultValue={dateInputValue(company.trial_ends_at)} />
      </label>
      <button className="button small" disabled={pending}>{pending ? "…" : "Enregistrer"}</button>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
    </form>
  );
}

function PaymentForm({ company }: { company: PlatformCompany }) {
  const [state, formAction, pending] = useActionState(recordSubscriptionPaymentAction, initialState);
  return (
    <form action={formAction} className="platform-payment-form">
      <input type="hidden" name="company_id" value={company.company_id} />
      <label>Date du paiement
        <input type="date" name="paid_at" required />
      </label>
      <label>Payé jusqu’au
        <input type="date" name="paid_through" defaultValue={dateInputValue(company.current_period_end)} required />
      </label>
      <label>Référence (facultative)
        <input name="reference" maxLength={200} defaultValue="" placeholder="Référence du paiement" />
      </label>
      <button className="button small" disabled={pending}>{pending ? "…" : "Enregistrer le paiement"}</button>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
    </form>
  );
}

function PlanLimitsForm({ plan }: { plan: PlatformPlan }) {
  const [state, formAction, pending] = useActionState(updateSubscriptionPlanLimitsAction, initialState);
  return (
    <form action={formAction} className="platform-plan-limit-form">
      <input type="hidden" name="plan_id" value={plan.id} />
      <label>Membres
        <input type="number" name="max_members" min="1" step="1" defaultValue={plan.max_members ?? ""} placeholder="Illimité" />
      </label>
      <label>Clients
        <input type="number" name="max_clients" min="0" step="1" defaultValue={plan.max_clients ?? ""} placeholder="Illimité" />
      </label>
      <label>Articles catalogue
        <input type="number" name="max_catalog_items" min="0" step="1" defaultValue={plan.max_catalog_items ?? ""} placeholder="Illimité" />
      </label>
      <label>Factures par mois
        <input type="number" name="max_monthly_invoices" min="0" step="1" defaultValue={plan.max_monthly_invoices ?? ""} placeholder="Illimité" />
      </label>
      <label>Factures par jour
        <input type="number" name="max_daily_invoices" min="0" step="1" defaultValue={plan.max_daily_invoices ?? ""} placeholder="Illimité" />
      </label>
      <button className="button small" disabled={pending}>{pending ? "…" : "Enregistrer les limites"}</button>
      <p className="muted">Laissez vide pour illimité. Le quota journalier est calculé en UTC.</p>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
    </form>
  );
}

function auditDateLabel(value: string) {
  return new Date(value).toLocaleDateString("fr-CD", { dateStyle: "medium", timeZone: "UTC" });
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
          <p>Gestion des entreprises clientes et des abonnements. Les modifications et paiements manuels sont consignés.</p>
        </div>
      </header>
      <section className="panel">
        <h2>Entreprises clientes</h2>
        <form method="get" className="platform-company-filters">
          <div><label htmlFor="company-search">Recherche</label><input id="company-search" name="q" maxLength={120} defaultValue={search} placeholder="Entreprise ou e-mail du propriétaire" /></div>
          <div><label htmlFor="subscription-filter">Statut</label><select id="subscription-filter" name="status" defaultValue={status}><option value="">Tous les statuts</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div><label htmlFor="plan-filter">Forfait</label><select id="plan-filter" name="plan" defaultValue={planId}><option value="">Tous les forfaits</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.is_active ? "" : " (inactif)"}</option>)}</select></div>
          <input type="hidden" name="page" value="0" />
          <button className="button primary">Filtrer</button>
        </form>
        {companies.length === 0 ? <p className="empty">Aucune entreprise ne correspond à ces filtres.</p> : <div className="scroll">
          <table className="platform-company-table">
            <thead><tr><th>Entreprise</th><th>Propriétaire / contact</th><th>Créée le</th><th>Usage</th><th>Abonnement et paiement</th></tr></thead>
            <tbody>{companies.map((company) => <tr key={company.company_id}>
              <td><strong>{company.company_name}</strong><small>{company.company_id}</small></td>
              <td>{company.owner_name || "—"}<small>{company.owner_email || "Contact indisponible"}</small></td>
              <td>{dateLabel(company.created_at)}</td>
              <td>{company.member_count} membres · {company.client_count} clients · {company.invoice_count} factures<small>Aujourd’hui : {company.invoices_today} / {company.max_daily_invoices ?? "illimité"} factures</small></td>
              <td>
                <small>Échéance : {dateLabel(company.current_period_end)} · Essai : {dateLabel(company.trial_ends_at)}</small>
                <small>Dernier paiement : {dateLabel(company.last_payment_at)}{company.last_payment_reference ? ` · Réf. ${company.last_payment_reference}` : ""}</small>
                <SubscriptionForm company={company} plans={plans} />
                <PaymentForm company={company} />
              </td>
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
        <h2>Limites d’usage par forfait</h2>
        <p className="muted">Ces plafonds s’appliquent à toutes les entreprises rattachées au forfait, y compris les limites de factures par jour et par mois.</p>
        <div className="platform-plan-list">
          {plans.map((plan) => <article className="platform-plan-card" key={plan.id}>
            <h3>{plan.name}{plan.is_active ? "" : " (inactif)"}</h3>
            <PlanLimitsForm plan={plan} />
          </article>)}
        </div>
      </section>
      <section className="panel">
        <h2>Journal d’audit récent</h2>
        {auditEvents.length === 0 ? <p className="empty">Aucune modification administrative enregistrée.</p> : <div className="scroll">
          <table className="platform-audit-table">
            <thead><tr><th>Date</th><th>Administrateur</th><th>Action</th><th>Entreprise</th><th>Avant → après</th></tr></thead>
            <tbody>{auditEvents.map((event) => <tr key={event.id}>
              <td>{auditDateLabel(event.created_at)}</td>
              <td>{event.actor_email || "Compte supprimé"}</td>
              <td>{event.action}</td>
              <td>{event.company_id || "—"}{event.after_data.plan_id ? <small>Forfait : {String(event.after_data.plan_id)}</small> : null}</td>
              <td><code>{JSON.stringify(event.before_data)} → {JSON.stringify(event.after_data)}</code></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
    </main>
  );
}
