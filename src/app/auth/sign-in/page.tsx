import Link from "next/link";
import { SignInForm } from "@/components/auth-form";

export default function SignInPage() {
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
          <p className="eyebrow">Content de vous revoir</p>
          <h2>Connexion</h2>
          <p className="lead">Connectez-vous à votre espace Facturo.</p>
          <SignInForm />
          <p className="signin-privacy">Vos données restent liées à votre espace professionnel.</p>
        </section>
      </div>
    </main>
  );
}
