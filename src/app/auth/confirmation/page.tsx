import Link from "next/link";
import { Suspense } from "react";
import { ConfirmationResendForm } from "@/components/auth-form";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

async function ConfirmationContent({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const linkProblem = status === "error";
  const oauthProblem = status === "oauth";
  const profileProblem = status === "profile";
  const hasProblem = linkProblem || oauthProblem || profileProblem;

  return (
    <main className="auth-shell signin-shell">
      <section className="auth-card confirmation-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <div className="confirmation-icon" aria-hidden="true">{hasProblem ? "!" : "✉"}</div>
        <p className="eyebrow">{hasProblem ? "Connexion à terminer" : "Dernière étape"}</p>
        <h1>{linkProblem ? "Ce lien ne fonctionne plus" : oauthProblem ? "La connexion Google/Facebook n’a pas abouti" : profileProblem ? "Compte connecté, profil Facturo manquant" : "Vérifiez votre boîte mail"}</h1>
        <p className="lead">
          {linkProblem
            ? "Le lien a peut-être expiré ou a déjà été utilisé. Vous pouvez demander un nouvel e-mail de confirmation ci-dessous."
            : oauthProblem
              ? "L’échange avec le fournisseur a échoué. Vérifiez que Google est activé dans le projet Supabase utilisé par Facturo et que son URL de retour est autorisée."
              : profileProblem
                ? "Google a connecté votre compte, mais Facturo ne trouve pas son profil d’entreprise dans ce projet Supabase. Vérifiez que les migrations Facturo y sont appliquées."
                : "Nous vous avons envoyé un lien pour confirmer votre adresse et activer votre compte Facturo."}
        </p>
        {!hasProblem && <p className="confirmation-tip">Le message peut prendre quelques minutes. Vérifiez aussi vos courriers indésirables.</p>}
        {linkProblem && <ConfirmationResendForm />}
        <p className="auth-switch">Vous avez déjà confirmé votre adresse ? <Link href="/auth/sign-in">Se connecter</Link></p>
      </section>
    </main>
  );
}

export default function ConfirmationPage(props: PageProps) {
  return <Suspense fallback={<main className="auth-shell signin-shell"><section className="auth-card confirmation-card"><p className="eyebrow">Dernière étape</p><h1>Vérifiez votre boîte mail</h1></section></main>}><ConfirmationContent {...props} /></Suspense>;
}
