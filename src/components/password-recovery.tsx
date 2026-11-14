"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  generateAdminRecoveryLinkAction,
  requestPasswordRecoveryAction,
  updatePasswordAction,
  type PasswordRecoveryActionState,
} from "@/app/actions/password-recovery";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const initialState: PasswordRecoveryActionState = {};

export function PasswordRecoveryRequestForm() {
  const [state, formAction, pending] = useActionState(requestPasswordRecoveryAction, initialState);

  return (
    <div className="auth-form">
      <form action={formAction}>
        <label htmlFor="recovery-email">Adresse e-mail de votre compte</label>
        <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} />
        {state.error && <p className="auth-error" role="alert">{state.error}</p>}
        {state.success && <p className="message" role="status">{state.success}</p>}
        <button className="button primary auth-submit" disabled={pending}>{pending ? "Envoi…" : "Envoyer un lien de récupération"}</button>
      </form>
      <p className="auth-switch"><Link href="/auth/sign-in">Retour à la connexion</Link></p>
    </div>
  );
}

export function RecoverySessionHandler() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function establishRecoverySession() {
      const currentUrl = new URL(window.location.href);
      const query = currentUrl.searchParams;
      const fragment = new URLSearchParams(currentUrl.hash.slice(1));
      const providerError = query.get("error_description") ?? fragment.get("error_description");
      const recoveryType = query.get("type") ?? fragment.get("type");
      if (providerError || (recoveryType && recoveryType !== "recovery")) {
        if (active) setError("Ce lien de récupération est invalide ou a expiré. Demandez-en un nouveau.");
        return;
      }
      if (!query.has("code") && !query.has("token_hash") && !(fragment.has("access_token") && fragment.has("refresh_token"))) {
        if (active) setError("Ce lien de récupération est incomplet. Demandez-en un nouveau.");
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient(false);
        let session: Session | null = null;

        if (query.has("code")) {
          const flowId = query.get("sb_flow_id");
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            query.get("code")!,
            flowId ? { flowId } : undefined,
          );
          if (exchangeError) throw exchangeError;
          session = data.session;
        } else if (query.has("token_hash")) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: query.get("token_hash")!,
            type: "recovery",
          });
          if (verifyError) throw verifyError;
          session = data.session;
        } else {
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: fragment.get("access_token")!,
            refresh_token: fragment.get("refresh_token")!,
          });
          if (setSessionError) throw setSessionError;
          session = data.session;
        }

        if (!session) throw new Error("Missing recovery session");
        router.replace("/auth/update-password");
      } catch (failure) {
        console.error("Facturo password recovery session establishment failed", {
          name: failure instanceof Error ? failure.name : "unknown",
          code: typeof failure === "object" && failure !== null && "code" in failure
            ? String(failure.code)
            : "unknown",
        });
        if (active) setError("Ce lien de récupération est invalide ou a expiré. Demandez-en un nouveau.");
      }
    }

    void establishRecoverySession();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <section className="auth-card confirmation-card">
      <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
      <p className="eyebrow">Récupération du compte</p>
      <h1>{error ? "Lien indisponible" : "Vérification du lien…"}</h1>
      {error
        ? <><p className="lead">{error}</p><Link className="button primary" href="/auth/forgot-password">Demander un nouveau lien</Link></>
        : <p className="lead">Nous vérifions votre lien sécurisé. Cette page va s’ouvrir automatiquement.</p>}
    </section>
  );
}

export function PasswordUpdateForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <div className="auth-form">
      <form action={formAction}>
        <label htmlFor="new-password">Nouveau mot de passe</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
        <label htmlFor="confirm-password">Confirmer le mot de passe</label>
        <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
        <p className="field-hint">Utilisez entre 8 et 72 caractères.</p>
        {state.error && <p className="auth-error" role="alert">{state.error}</p>}
        {state.success && <p className="message" role="status">{state.success}</p>}
        <button className="button primary auth-submit" disabled={pending}>{pending ? "Mise à jour…" : "Mettre à jour le mot de passe"}</button>
      </form>
    </div>
  );
}

export function AdminRecoveryLink({ link }: { link: string }) {
  const [feedback, setFeedback] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setFeedback("Lien copié. Transmettez-le directement à l’utilisateur.");
    } catch {
      setFeedback("La copie automatique a échoué. Sélectionnez le lien affiché et copiez-le manuellement.");
    }
  }

  return (
    <div className="admin-recovery-link">
      <label htmlFor="generated-recovery-link">Lien temporaire (à usage unique)</label>
      <input id="generated-recovery-link" type="text" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      <button className="button small" type="button" onClick={copyLink}>Copier le lien</button>
      {feedback && <p className="muted" role="status">{feedback}</p>}
    </div>
  );
}

export function AdminRecoveryRequestForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(generateAdminRecoveryLinkAction, initialState);

  return (
    <div className="admin-recovery-actions">
      {!state.recoveryLink && <form action={formAction}>
        <input type="hidden" name="request_id" value={requestId} />
        <button className="button small" disabled={pending}>{pending ? "Génération…" : "Générer le lien à usage unique"}</button>
      </form>}
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="message" role="status">{state.success}</p>}
      {state.recoveryLink && <AdminRecoveryLink link={state.recoveryLink} />}
    </div>
  );
}
