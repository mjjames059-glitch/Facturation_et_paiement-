import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facturo — Facturation et suivi des paiements",
  description: "Créez vos factures et suivez vos encaissements avec Facturo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
