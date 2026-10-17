import Link from "next/link";
import { SignUpForm } from "@/components/auth-form";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-wide">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <h1>Créer votre compte</h1>
        <p className="lead">Quelques informations pour adapter l’outil à votre activité.</p>
        <SignUpForm />
      </section>
    </main>
  );
}
