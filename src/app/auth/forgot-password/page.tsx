import Link from "next/link";
import type { Metadata } from "next";
import { PasswordRecoveryRequestForm } from "@/components/password-recovery";

export const metadata: Metadata = {
  title: "Mot de passe oublié | Facturo",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="auth-shell signin-shell">
      <section className="auth-card confirmation-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <p className="eyebrow">Récupération du compte</p>
        <h1>Mot de passe oublié ?</h1>
        <p className="lead">Saisissez l’adresse e-mail de votre compte. Vous pouvez demander au maximum deux liens par jour.</p>
        <PasswordRecoveryRequestForm />
      </section>
    </main>
  );
}
