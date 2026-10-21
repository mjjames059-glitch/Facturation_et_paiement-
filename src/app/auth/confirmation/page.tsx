import Link from "next/link";
import { Suspense } from "react";
import { ConfirmationResendForm } from "@/components/auth-form";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

async function ConfirmationContent({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const linkProblem = status === "error";

  return (
    <main className="auth-shell signin-shell">
      <section className="auth-card confirmation-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <div className="confirmation-icon" aria-hidden="true">{linkProblem ? "!" : "✉"}</div>
        <p className="eyebrow">{linkProblem ? "Lien à renouveler" : "Dernière étape"}</p>
        <h1>{linkProblem ? "Ce lien ne fonctionne plus" : "Vérifiez votre boîte mail"}</h1>
        <p className="lead">
          {linkProblem
            ? "Le lien a peut-être expiré ou a déjà été utilisé. Vous pouvez demander un nouvel e-mail de confirmation ci-dessous."
            : "Nous vous avons envoyé un lien pour confirmer votre adresse et activer votre compte Facturo."}
        </p>
        {!linkProblem && <p className="confirmation-tip">Le message peut prendre quelques minutes. Vérifiez aussi vos courriers indésirables.</p>}
        <ConfirmationResendForm />
        <p className="auth-switch">Vous avez déjà confirmé votre adresse ? <Link href="/auth/sign-in">Se connecter</Link></p>
      </section>
    </main>
  );
}

export default function ConfirmationPage(props: PageProps) {
  return <Suspense fallback={<main className="auth-shell signin-shell"><section className="auth-card confirmation-card"><p className="eyebrow">Dernière étape</p><h1>Vérifiez votre boîte mail</h1></section></main>}><ConfirmationContent {...props} /></Suspense>;
}
