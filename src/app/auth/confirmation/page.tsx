import Link from "next/link";
import { Suspense } from "react";
import { ConfirmationResendForm } from "@/components/auth-form";

type PageProps = {
  searchParams: Promise<{ status?: string; reason?: string; detail?: string }>;
};

async function ConfirmationContent({ searchParams }: PageProps) {
  const { status, reason, detail } = await searchParams;
  const linkProblem = status === "error";
  const oauthProblem = status === "oauth";
  const profileProblem = status === "profile";
  const sessionProblem = status === "session";
  const hasProblem = linkProblem || oauthProblem || profileProblem || sessionProblem;
  const oauthMessage = reason === "provider"
    ? "Google a refusé ou interrompu la demande. Recommencez et acceptez la connexion."
    : reason === "redirect_not_allowed"
      ? "Supabase a refusé l’URL de retour de la connexion. Ajoutez l’URL de callback de cette application dans Authentication → URL Configuration → Redirect URLs, puis réessayez."
      : reason === "missing_code"
        ? "Le retour de Google ne contenait pas le code de connexion attendu. Vérifiez l’URL de retour autorisée dans Supabase."
        : reason === "pkce"
          ? "Le navigateur n’a pas conservé l’état temporaire de connexion. Recommencez dans le même navigateur, sur le même domaine Facturo."
          : reason === "expired_code"
            ? "Le code de connexion a expiré ou a déjà servi. Recommencez le parcours Google depuis Facturo."
            : reason === "server"
              ? "Le serveur Facturo n’a pas pu terminer le retour OAuth. Consultez les journaux de la fonction /auth/callback dans Vercel."
              : "Supabase n’a pas pu échanger le code Google. Vérifiez que les variables Vercel ciblent le même projet Supabase que celui configuré pour Google.";

  return (
    <main className="auth-shell signin-shell">
      <section className="auth-card confirmation-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <div className="confirmation-icon" aria-hidden="true">{hasProblem ? "!" : "✉"}</div>
        <p className="eyebrow">{hasProblem ? "Connexion à terminer" : "Dernière étape"}</p>
        <h1>{linkProblem ? "Ce lien ne fonctionne plus" : oauthProblem ? "La connexion Google/Facebook n’a pas abouti" : sessionProblem ? "Session non retrouvée après connexion" : profileProblem ? "Compte connecté, profil Facturo manquant" : "Vérifiez votre boîte mail"}</h1>
        <p className="lead">
          {linkProblem
            ? "Le lien a peut-être expiré ou a déjà été utilisé. Vous pouvez demander un nouvel e-mail de confirmation ci-dessous."
            : oauthProblem
              ? oauthMessage
              : sessionProblem
                ? "Le retour Google a atteint le tableau de bord, mais le serveur ne retrouve pas la session. Vérifiez que l’adresse du site est identique du début à la fin de la connexion. Si le problème continue, consultez les journaux Vercel pour l’erreur du contrôle de session."
              : profileProblem
                ? "Google a connecté votre compte, mais Facturo ne trouve pas son profil d’entreprise dans ce projet Supabase. Vérifiez que les migrations Facturo y sont appliquées."
                : "Nous vous avons envoyé un lien pour confirmer votre adresse et activer votre compte Facturo."}
        </p>
        {!hasProblem && <p className="confirmation-tip">Le message peut prendre quelques minutes. Vérifiez aussi vos courriers indésirables.</p>}
        {oauthProblem && detail && <p className="confirmation-tip">Détail Supabase : {detail}</p>}
        {linkProblem && <ConfirmationResendForm />}
        <p className="auth-switch">Vous avez déjà confirmé votre adresse ? <Link href="/auth/sign-in">Se connecter</Link></p>
      </section>
    </main>
  );
}

export default function ConfirmationPage(props: PageProps) {
  return <Suspense fallback={<main className="auth-shell signin-shell"><section className="auth-card confirmation-card"><p className="eyebrow">Dernière étape</p><h1>Vérifiez votre boîte mail</h1></section></main>}><ConfirmationContent {...props} /></Suspense>;
}
