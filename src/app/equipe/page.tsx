import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import WorkspaceHeader from "@/components/workspace-header";
import TeamScreen from "@/components/team-screen";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

async function TeamData() {
  await connection();
  const context = await requireAuthenticatedCompany();
  if (context.role !== "owner" && context.role !== "manager") redirect("/tableau-de-bord");

  const [{ data: members, error: membersError }, { data: invitations, error: invitationsError }] = await Promise.all([
    context.supabase.from("profiles").select("user_id, role, display_name, created_at").eq("company_id", context.companyId).order("created_at"),
    context.supabase.from("company_invitations").select("id, email, role, created_at, expires_at").eq("company_id", context.companyId).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);

  return <><WorkspaceHeader email={context.user.email ?? ""} role={context.role} /><TeamScreen
    members={(members ?? []) as Parameters<typeof TeamScreen>[0]["members"]}
    invitations={(invitations ?? []) as Parameters<typeof TeamScreen>[0]["invitations"]}
    role={context.role}
  />{(membersError || invitationsError) && <p className="auth-error team-load-error">Certaines données de l’équipe n’ont pas pu être chargées. Vérifiez que la migration de gestion d’équipe est appliquée.</p>}</>;
}

export default function TeamPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement de l’équipe…</p></main>}><TeamData /></Suspense>;
}
