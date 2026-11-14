"use client";

import { useActionState } from "react";
import { updateCompanyProfileAction, updateExchangeRateAction, updatePersonalEmailAction, updatePersonalProfileAction, updateWorkspacePreferencesAction, uploadCompanyLogoAction, type SettingsActionState } from "@/app/actions/settings";

type CompanySettings = {
  company_name: string;
  legal_name: string | null;
  contact_email: string | null;
  address: string | null;
  phone: string | null;
  rccm: string | null;
  nif: string | null;
};

type WorkspacePreferences = {
  brand_primary_color: string;
  brand_accent_color: string;
  locale: string;
  default_currency: "USD" | "CDF";
  invoice_due_days: number;
  invoice_footer: string;
};

const initialState: SettingsActionState = {};

export default function SettingsScreen({ company, logoUrl, exchangeRate, preferences, loadError, canManage, role, email, personalProfile }: { company: CompanySettings; logoUrl: string | null; exchangeRate: string; preferences: WorkspacePreferences; loadError: boolean; canManage: boolean; role: string; email: string; personalProfile: { display_name: string | null; phone: string | null } }) {
  const [personalState, personalAction, personalPending] = useActionState(updatePersonalProfileAction, initialState);
  const [emailState, emailAction, emailPending] = useActionState(updatePersonalEmailAction, initialState);
  const [profileState, profileAction, profilePending] = useActionState(updateCompanyProfileAction, initialState);
  const [preferencesState, preferencesAction, preferencesPending] = useActionState(updateWorkspacePreferencesAction, initialState);
  const [logoState, logoAction, logoPending] = useActionState(uploadCompanyLogoAction, initialState);
  const [rateState, rateAction, ratePending] = useActionState(updateExchangeRateAction, initialState);

  return (
    <div className="workspace-wrap">
      <h1>Paramètres</h1>
      <p className="lead">Profil de votre entreprise et conversion USD/CDF.</p>
      {loadError && <p className="auth-error" role="alert">Impossible de charger tous les paramètres. Vérifiez les migrations Supabase.</p>}
      <section className="panel">
        <h2>Mon profil personnel</h2>
        <p className="muted">Rôle dans l’équipe : {{ owner: "Propriétaire", manager: "Gestionnaire", accountant: "Comptable", collaborator: "Collaborateur", viewer: "Lecture seule" }[role] ?? "Membre"}</p>
        <form action={emailAction} className="personal-email-form">
          <label htmlFor="personal-email">Adresse de connexion</label><div className="personal-email-row"><input id="personal-email" name="email" type="email" autoComplete="email" defaultValue={email} required maxLength={254} /><button className="button" disabled={emailPending}>{emailPending ? "Envoi…" : "Modifier l’e-mail"}</button></div>
          {emailState.error && <p className="auth-error" role="alert">{emailState.error}</p>}
          {emailState.success && <p className="message" role="status">{emailState.success}</p>}
        </form>
        <form action={personalAction}>
          <div className="grid-two">
            <div><label htmlFor="display-name">Nom affiché</label><input id="display-name" name="display_name" defaultValue={personalProfile.display_name ?? ""} required minLength={2} maxLength={100} /></div>
            <div><label htmlFor="personal-phone">Téléphone</label><input id="personal-phone" name="phone" type="tel" defaultValue={personalProfile.phone ?? ""} maxLength={40} /></div>
          </div>
          {personalState.error && <p className="auth-error" role="alert">{personalState.error}</p>}
          {personalState.success && <p className="message" role="status">{personalState.success}</p>}
          <div className="inline-action"><button className="button primary" disabled={personalPending}>{personalPending ? "Enregistrement…" : "Enregistrer mon profil"}</button></div>
        </form>
      </section>
      {!canManage && <p className="context context-grey">Votre rôle vous permet de consulter l’entreprise. Seul un propriétaire ou gestionnaire peut modifier ses paramètres.</p>}
      {canManage && <>
      <section className="panel">
        <h2>Profil entreprise</h2>
        <form action={profileAction}>
          <div className="grid-two">
            <div><label htmlFor="company-name">Nom affiché</label><input id="company-name" name="company_name" defaultValue={company.company_name} required minLength={2} maxLength={120} /></div>
            <div><label htmlFor="legal-name">Raison sociale</label><input id="legal-name" name="legal_name" defaultValue={company.legal_name ?? company.company_name} maxLength={160} /></div>
            <div><label htmlFor="company-email">E-mail professionnel</label><input id="company-email" name="contact_email" type="email" defaultValue={company.contact_email ?? ""} maxLength={254} /></div>
            <div><label htmlFor="company-phone">Téléphone</label><input id="company-phone" name="phone" type="tel" defaultValue={company.phone ?? ""} maxLength={40} /></div>
            <div><label htmlFor="company-address">Adresse</label><input id="company-address" name="address" defaultValue={company.address ?? ""} maxLength={300} /></div>
            <div><label htmlFor="company-rccm">RCCM</label><input id="company-rccm" name="rccm" defaultValue={company.rccm ?? ""} maxLength={80} /></div>
            <div><label htmlFor="company-nif">NIF</label><input id="company-nif" name="nif" defaultValue={company.nif ?? ""} maxLength={80} /></div>
          </div>
          {profileState.error && <p className="auth-error" role="alert">{profileState.error}</p>}
          {profileState.success && <p className="message" role="status">{profileState.success}</p>}
          <div className="inline-action"><button className="button primary" disabled={profilePending}>{profilePending ? "Enregistrement…" : "Enregistrer le profil"}</button></div>
        </form>
        <div className="logo-upload-section">
          <div className="logo-preview" role="img" aria-label="Logo de l’entreprise" style={logoUrl ? { backgroundImage: `url("${logoUrl}")` } : undefined}>{logoUrl ? null : <span>Logo</span>}</div>
          <form action={logoAction}>
            <label htmlFor="company-logo">Logo (PNG, JPEG ou WebP · 2 Mo maximum)</label>
            <input id="company-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required />
            {logoState.error && <p className="auth-error" role="alert">{logoState.error}</p>}
            {logoState.success && <p className="message" role="status">{logoState.success}</p>}
            <div className="inline-action"><button className="button" disabled={logoPending}>{logoPending ? "Téléversement…" : "Mettre à jour le logo"}</button></div>
          </form>
        </div>
      </section>
      <section className="panel">
        <h2>Identité visuelle et factures</h2>
        <p className="muted">Ces préférences sont propres à cet espace et apparaissent sur les factures partagées et leurs PDF.</p>
        <form action={preferencesAction}>
          <div className="grid-two">
            <div><label htmlFor="brand-primary">Couleur principale</label><input id="brand-primary" name="brand_primary_color" type="color" defaultValue={preferences.brand_primary_color} /></div>
            <div><label htmlFor="brand-accent">Couleur secondaire</label><input id="brand-accent" name="brand_accent_color" type="color" defaultValue={preferences.brand_accent_color} /></div>
            <div><label htmlFor="workspace-locale">Langue et format de date</label><select id="workspace-locale" name="locale" defaultValue={preferences.locale}><option value="fr-CD">Français — RDC</option><option value="fr-FR">Français — France</option><option value="en-US">English — US</option></select></div>
            <div><label htmlFor="default-currency">Devise par défaut des factures</label><select id="default-currency" name="default_currency" defaultValue={preferences.default_currency}><option value="USD">Dollar (USD)</option><option value="CDF">Franc congolais (CDF)</option></select></div>
            <div><label htmlFor="invoice-due-days">Délai de paiement par défaut (jours)</label><input id="invoice-due-days" name="invoice_due_days" type="number" min="0" max="365" step="1" defaultValue={preferences.invoice_due_days} required /></div>
          </div>
          <label htmlFor="invoice-footer">Texte légal ou pied de facture</label>
          <textarea id="invoice-footer" name="invoice_footer" rows={3} maxLength={2000} defaultValue={preferences.invoice_footer} />
          {preferencesState.error && <p className="auth-error" role="alert">{preferencesState.error}</p>}
          {preferencesState.success && <p className="message" role="status">{preferencesState.success}</p>}
          <div className="inline-action"><button className="button primary" disabled={preferencesPending}>{preferencesPending ? "Enregistrement…" : "Enregistrer l’identité visuelle"}</button></div>
        </form>
      </section>
      <section className="panel">
        <h2>Taux de change</h2>
        <p className="muted">Ce taux sert à comparer les montants CDF et USD dans le tableau de bord.</p>
        <form action={rateAction} className="rate-form"><div><label htmlFor="exchange-rate">1 USD =</label><input id="exchange-rate" name="exchange_rate" type="number" inputMode="decimal" min="0.0001" max="9999999999.9999" step="0.0001" defaultValue={exchangeRate} required /></div><span>CDF</span>
          {rateState.error && <p className="auth-error" role="alert">{rateState.error}</p>}
          {rateState.success && <p className="message" role="status">{rateState.success}</p>}
          <button className="button primary" disabled={ratePending}>{ratePending ? "Enregistrement…" : "Enregistrer le taux"}</button>
        </form>
      </section>
      </>}
    </div>
  );
}
