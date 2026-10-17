"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label htmlFor="email">Adresse e-mail</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <label htmlFor="password">Mot de passe</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="button primary auth-submit" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
      <p className="auth-switch">Vous n’avez pas encore de compte ? <Link href="/auth/sign-up">Créer un compte</Link></p>
    </form>
  );
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const [vatStatus, setVatStatus] = useState("no");

  return (
    <form action={formAction} className="auth-form">
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
      <p className="auth-switch">Vous avez déjà un compte ? <Link href="/auth/sign-in">Se connecter</Link></p>
    </form>
  );
}
