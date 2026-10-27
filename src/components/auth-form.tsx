"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { completeOAuthRegistrationAction, resendConfirmationAction, signInAction, signUpAction, type AuthActionState } from "@/app/actions/auth";
import { acceptTeamInvitationAction, type TeamActionState } from "@/app/actions/team";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const initialState: AuthActionState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [oauthPending, setOauthPending] = useState<"google" | "facebook" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  async function signInWithProvider(provider: "google" | "facebook") {
    setOauthPending(provider);
    setOauthError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      setOauthError(error instanceof Error ? error.message : "La connexion OAuth n’a pas pu démarrer.");
      setOauthPending(null);
    }
  }

  return (
    <div className="auth-form signin-form">
      <section className="signin-provider-section" aria-label="Connexion avec Google ou Facebook">
        <p className="signin-method-title">Connexion avec un compte social</p>
        <div className="auth-providers">
          <button className="button provider-button" type="button" onClick={() => void signInWithProvider("google")} disabled={oauthPending !== null}><span className="provider-mark google-mark">G</span>{oauthPending === "google" ? "Connexion…" : "Continuer avec Google"}</button>
          <button className="button provider-button" type="button" onClick={() => void signInWithProvider("facebook")} disabled={oauthPending !== null}><span className="provider-mark facebook-mark">f</span>{oauthPending === "facebook" ? "Connexion…" : "Continuer avec Facebook"}</button>
        </div>
      </section>
      {oauthError && <p className="auth-error" role="alert">{oauthError}</p>}
      <div className="signin-divider"><span>ou avec votre e-mail</span></div>
      <form action={formAction} className="signin-credentials">
        <div className="signin-field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" placeholder="nom@entreprise.com" required maxLength={254} /></div>
        <div className="signin-field"><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Votre mot de passe" required /></div>
        {state.error && <p className="auth-error" role="alert">{state.error}</p>}
        <button className="button primary auth-submit" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
      </form>
      <p className="auth-switch">Vous n’avez pas encore de compte ? <Link href="/auth/sign-up">Créer un compte</Link></p>
    </div>
  );
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const [vatStatus, setVatStatus] = useState("no");

  return (
    <form action={formAction} className="auth-form">
      <GoogleSignUpButton />
      <div className="signin-divider"><span>ou créez un compte avec votre e-mail</span></div>
      <div className="grid-two">
        <div><label htmlFor="display-name">Votre nom</label><input id="display-name" name="display_name" autoComplete="name" maxLength={100} /></div>
        <div><label htmlFor="company-name">Nom de l’entreprise</label><input id="company-name" name="company_name" placeholder="Ex. Traiteur Mama Zita" required minLength={2} maxLength={120} /></div>
      </div>
      <label htmlFor="sector">Secteur d’activité</label>
      <select id="sector" name="sector" defaultValue="Restauration et alimentation">
        <option>Restauration et alimentation</option><option>Services et conseil</option><option>Commerce et distribution</option><option>BTP et construction</option><option>Transport et logistique</option><option>Éducation</option><option>Autre</option>
      </select>
      <fieldset className="auth-fieldset">
        <legend>Vos clients sont</legend>
        <div className="dishes choices">
          <label><input type="checkbox" name="served_client_types" value="b2b" defaultChecked /> Des entreprises</label>
          <label><input type="checkbox" name="served_client_types" value="b2a" defaultChecked /> Des administrations</label>
          <label><input type="checkbox" name="served_client_types" value="b2c" defaultChecked /> Des particuliers</label>
        </div>
      </fieldset>
      <fieldset className="auth-fieldset">
        <legend>Êtes-vous assujetti à la TVA ?</legend>
        <div className="dishes">
          {[ ["no", "Non"], ["yes", "Oui"], ["unknown", "Je ne sais pas"] ].map(([value, label]) => <label className={`choice-pill${vatStatus === value ? " active" : ""}`} key={value}>
            <input type="radio" name="vat_status" value={value} checked={vatStatus === value} onChange={() => setVatStatus(value)} />{label}
          </label>)}
        </div>
        {vatStatus === "yes" && <div className="context context-spice vat-notice"><b>Option DGI bientôt disponible.</b><p>Vous pouvez commencer avec l’offre de base. Rejoignez la liste d’attente pour être prévenu de son lancement.</p><label className="waitlist-choice"><input type="checkbox" name="join_waitlist" /> Rejoindre la liste d’attente</label></div>}
        {vatStatus === "unknown" && <p className="note">En attendant de vérifier, vous pouvez commencer avec l’offre de base.</p>}
      </fieldset>
      <div className="grid-two">
        <div><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
        <div><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /><span className="field-hint">8 caractères minimum</span></div>
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
      <button className="button primary auth-submit" disabled={pending}>{pending ? "Création…" : "Créer mon compte"}</button>
    </form>
  );
}

function GoogleSignUpButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    setPending(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?mode=signup` },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion Google indisponible. Réessayez.");
      setPending(false);
    }
  }

  return <div>
    <button className="button provider-button" type="button" onClick={() => void continueWithGoogle()} disabled={pending}>
      <span className="provider-mark google-mark">G</span>{pending ? "Connexion…" : "Utiliser Google pour mes informations personnelles"}
    </button>
    <p className="field-hint">Le nom et l’adresse e-mail viennent de Google. Vous saisirez les informations de votre entreprise ensuite.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>;
}

export function OAuthCompanyRegistrationForm({ email, displayName }: { email: string; displayName: string }) {
  const [state, formAction, pending] = useActionState(completeOAuthRegistrationAction, initialState);
  const [vatStatus, setVatStatus] = useState("unknown");

  return <form action={formAction} className="auth-form">
    <div className="grid-two">
      <div><label htmlFor="oauth-display-name">Votre nom</label><input id="oauth-display-name" name="display_name" autoComplete="name" defaultValue={displayName} required minLength={2} maxLength={100} /></div>
      <div><label htmlFor="oauth-email">Adresse e-mail du compte social</label><input id="oauth-email" type="email" value={email} readOnly /></div>
    </div>
    <p className="field-hint">Ces informations personnelles viennent de votre connexion sociale. Complétez séparément les renseignements de votre entreprise.</p>
    <div><label htmlFor="google-company-name">Nom de l’entreprise</label><input id="google-company-name" name="company_name" required minLength={2} maxLength={120} /></div>
    <label htmlFor="google-sector">Secteur d’activité</label>
    <select id="google-sector" name="sector" defaultValue="Autre">
      <option>Restauration et alimentation</option><option>Services et conseil</option><option>Commerce et distribution</option><option>BTP et construction</option><option>Transport et logistique</option><option>Éducation</option><option>Autre</option>
    </select>
    <fieldset className="auth-fieldset">
      <legend>Vos clients sont</legend>
      <div className="dishes choices">
        <label><input type="checkbox" name="served_client_types" value="b2b" defaultChecked /> Des entreprises</label>
        <label><input type="checkbox" name="served_client_types" value="b2a" defaultChecked /> Des administrations</label>
        <label><input type="checkbox" name="served_client_types" value="b2c" defaultChecked /> Des particuliers</label>
      </div>
    </fieldset>
    <fieldset className="auth-fieldset">
      <legend>Êtes-vous assujetti à la TVA ?</legend>
      <div className="dishes">
        {[ ["no", "Non"], ["yes", "Oui"], ["unknown", "Je ne sais pas"] ].map(([value, label]) => <label className={`choice-pill${vatStatus === value ? " active" : ""}`} key={value}>
          <input type="radio" name="vat_status" value={value} checked={vatStatus === value} onChange={() => setVatStatus(value)} />{label}
        </label>)}
      </div>
      {vatStatus === "yes" && <label className="waitlist-choice"><input type="checkbox" name="join_waitlist" /> Rejoindre la liste d’attente DGI</label>}
    </fieldset>
    {state.error && <p className="auth-error" role="alert">{state.error}</p>}
    <button className="button primary auth-submit" disabled={pending}>{pending ? "Finalisation…" : "Créer mon espace Facturo"}</button>
  </form>;
}

export function ConfirmationResendForm() {
  const [state, formAction, pending] = useActionState(resendConfirmationAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      <div className="signin-field">
        <label htmlFor="confirmation-email">Adresse e-mail utilisée pour l’inscription</label>
        <input id="confirmation-email" name="email" type="email" autoComplete="email" placeholder="nom@entreprise.com" required maxLength={254} />
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
      <button className="button primary auth-submit" disabled={pending}>
        {pending ? "Envoi en cours…" : "Renvoyer le lien de confirmation"}
      </button>
    </form>
  );
}

export function InvitationRegistrationForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(acceptTeamInvitationAction, {} as TeamActionState);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="token" value={token} />
      <div className="signin-field"><label htmlFor="invite-display-name">Votre nom</label><input id="invite-display-name" name="display_name" autoComplete="name" required minLength={2} maxLength={100} /></div>
      <div className="signin-field"><label htmlFor="invite-email">Adresse e-mail invitée</label><input id="invite-email" name="email" type="email" value={email} readOnly /></div>
      <div className="signin-field"><label htmlFor="invite-password">Créer un mot de passe</label><input id="invite-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /><span className="field-hint">8 caractères minimum</span></div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="button primary auth-submit" disabled={pending}>{pending ? "Création du compte…" : "Rejoindre l’équipe"}</button>
    </form>
  );
}
