import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth-form";
import { SiteLinks } from "@/components/site-links";

async function SignInGreeting() {
  const hasSignedInBefore = (await cookies()).has("facturo_seen_login");
  return <p className="eyebrow">{hasSignedInBefore ? "Content de vous revoir" : "Bienvenue sur Facturo"}</p>;
}

type PageProps = { searchParams: Promise<{ notice?: string }> };

async function SignInNotice({ searchParams }: PageProps) {
  const { notice } = await searchParams;
  const noticeMessage = notice === "confirmed"
    ? "Votre adresse e-mail est confirmée. Connectez-vous avec votre adresse e-mail et votre mot de passe."
    : notice === "registered"
      ? "Votre espace Facturo est créé. Connectez-vous avec l’adresse e-mail de votre compte social et le mot de passe que vous venez de définir."
      : notice === "exists"
        ? "Un espace existe déjà avec ce compte. Connectez-vous pour le retrouver."
        : null;

  return noticeMessage ? <p className="message" role="status">{noticeMessage}</p> : null;
}

export default function SignInPage(props: PageProps) {
  return (
    <main className="auth-shell signin-shell">
      <div className="signin-layout">
        <section className="signin-intro">
          <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
          <p className="eyebrow">Votre activité, en toute simplicité</p>
          <h1>Tout votre travail au même endroit.</h1>
          <p>Retrouvez vos clients, votre catalogue et vos factures dans un espace conçu pour vous faire gagner du temps.</p>
          <ul><li>Créez et partagez vos factures</li><li>Suivez vos paiements en un coup d’œil</li><li>Gardez vos clients et produits à portée de main</li></ul>
        </section>
        <section className="auth-card signin-card">
          <Suspense fallback={<p className="eyebrow">Bienvenue sur Facturo</p>}><SignInGreeting /></Suspense>
          <h2>Connexion</h2>
          <p className="lead">Connectez-vous à votre espace Facturo.</p>
          <Suspense fallback={null}><SignInNotice {...props} /></Suspense>
          <SignInForm />
          <p className="signin-privacy">Vos données restent liées à votre espace professionnel.</p>
          <SiteLinks className="auth-legal-nav" />
        </section>
      </div>
    </main>
  );
}
