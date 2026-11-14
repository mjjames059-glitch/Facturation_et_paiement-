import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import SupportScreen from "@/components/support-screen";
import WorkspaceHeader from "@/components/workspace-header";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Aide et contact — Facturo",
  description: "Consultez les réponses aux questions fréquentes ou envoyez un message à l’équipe Facturo.",
};

async function HelpData() {
  await connection();
  const context = await requireAuthenticatedCompany();
  if (!context.user.email) redirect("/auth/sign-in");

  return (
    <>
      <WorkspaceHeader email={context.user.email} role={context.role} workspaces={context.workspaces} />
      <SupportScreen senderName={context.profile.display_name ?? ""} senderEmail={context.user.email} />
    </>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><p>Chargement de l’aide…</p></main>}>
      <HelpData />
    </Suspense>
  );
}
