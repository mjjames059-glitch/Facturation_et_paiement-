import Link from "next/link";
import type { Metadata } from "next";
import { PasswordUpdateForm } from "@/components/password-recovery";

export const metadata: Metadata = {
  title: "Nouveau mot de passe | Facturo",
  robots: { index: false, follow: false },
};

export default function UpdatePasswordPage() {
  return (
    <main className="auth-shell signin-shell">
      <section className="auth-card confirmation-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <p className="eyebrow">Récupération du compte</p>
        <h1>Choisissez un nouveau mot de passe</h1>
        <p className="lead">Après la mise à jour, vous serez redirigé vers votre espace Facturo.</p>
        <PasswordUpdateForm />
      </section>
    </main>
  );
}
