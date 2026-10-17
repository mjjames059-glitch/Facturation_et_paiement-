import Link from "next/link";
import { SignInForm } from "@/components/auth-form";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <h1>Connexion</h1>
        <p className="lead">Connectez-vous à votre espace Facturo.</p>
        <SignInForm />
      </section>
    </main>
  );
}
