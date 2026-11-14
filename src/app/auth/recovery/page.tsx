import type { Metadata } from "next";
import { RecoverySessionHandler } from "@/components/password-recovery";

export const metadata: Metadata = {
  title: "Vérification du lien | Facturo",
  robots: { index: false, follow: false },
};

export default function RecoveryPage() {
  return (
    <main className="auth-shell signin-shell">
      <RecoverySessionHandler />
    </main>
  );
}
