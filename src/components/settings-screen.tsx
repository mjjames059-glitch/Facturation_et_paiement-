"use client";

import { useActionState } from "react";
import { updateCompanyProfileAction, updateExchangeRateAction, updatePersonalEmailAction, updatePersonalProfileAction, uploadCompanyLogoAction, type SettingsActionState } from "@/app/actions/settings";

type CompanySettings = {
  company_name: string;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  rccm: string | null;
  nif: string | null;
};

const initialState: SettingsActionState = {};

export default function SettingsScreen({ company, logoUrl, exchangeRate, loadError, canManage, role, email, personalProfile }: { company: CompanySettings; logoUrl: string | null; exchangeRate: string; loadError: boolean; canManage: boolean; role: string; email: string; personalProfile: { display_name: string | null; phone: string | null } }) {
  const [personalState, personalAction, personalPending] = useActionState(updatePersonalProfileAction, initialState);
  const [emailState, emailAction, emailPending] = useActionState(updatePersonalEmailAction, initialState);
  const [profileState, profileAction, profilePending] = useActionState(updateCompanyProfileAction, initialState);
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
        <p className="muted">Nom du compte : {company.company_name}</p>
        <form action={profileAction}>
          <div className="grid-two">
            <div><label htmlFor="legal-name">Raison sociale</label><input id="legal-name" name="legal_name" defaultValue={company.legal_name ?? company.company_name} maxLength={160} /></div>
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
        <h2>Taux de change</h2>
        <p className="muted">Ce taux sert à comparer les montants CDF et USD dans le tableau de bord.</p>
        <form action={rateAction} className="rate-form"><div><label htmlFor="exchange-rate">1 USD =</label><input id="exchange-rate" name="exchange_rate" inputMode="decimal" defaultValue={exchangeRate} required /></div><span>CDF</span>
          {rateState.error && <p className="auth-error" role="alert">{rateState.error}</p>}
          {rateState.success && <p className="message" role="status">{rateState.success}</p>}
          <button className="button primary" disabled={ratePending}>{ratePending ? "Enregistrement…" : "Enregistrer le taux"}</button>
        </form>
      </section>
      </>}
    </div>
  );
}
