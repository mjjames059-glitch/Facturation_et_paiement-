import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getCompanyLogoUrl } from "@/lib/supabase/storage";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Bienvenue dans votre espace | Facturo",
  description: "Votre espace professionnel Facturo est prêt.",
};

async function WorkspaceWelcomeContent() {
  await connection();
  const { companyId, workspaces } = await requireAuthenticatedCompany();
  const workspace = workspaces.find((item) => item.company_id === companyId && item.is_current);
  if (!workspace) {
    throw new Error("Impossible de trouver l’espace de travail actif après la connexion.");
  }

  const logoUrl = getCompanyLogoUrl(workspace.logo_path);

  return (
    <main className="auth-shell signin-shell">
      <section className="auth-card confirmation-card workspace-welcome-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        <p className="eyebrow">Espace actif</p>
        <div className="workspace-welcome-company">
          {logoUrl && <span className="workspace-logo" role="img" aria-label={`Logo de ${workspace.company_name}`} style={{ backgroundImage: `url("${logoUrl}")` }} />}
          <h1>{workspace.company_name}</h1>
        </div>
        <p className="lead">Votre espace professionnel est prêt.</p>
        <Link className="button primary" href="/tableau-de-bord">Accéder au tableau de bord</Link>
      </section>
    </main>
  );
}

export default function WorkspaceWelcomePage() {
  return (
    <Suspense fallback={<main className="auth-shell signin-shell"><section className="auth-card confirmation-card workspace-welcome-card"><p className="eyebrow">Préparation de votre espace…</p></section></main>}>
      <WorkspaceWelcomeContent />
    </Suspense>
  );
}
