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

  const [{ data: memberships, error: membershipsError }, { data: invitations, error: invitationsError }] = await Promise.all([
    context.supabase.from("company_memberships").select("user_id, role, created_at").eq("company_id", context.companyId).order("created_at"),
    context.supabase.from("company_invitations").select("id, email, role, created_at, expires_at").eq("company_id", context.companyId).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const memberIds = (memberships ?? []).map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = memberIds.length
    ? await context.supabase.from("profiles").select("user_id, display_name").in("user_id", memberIds)
    : { data: [], error: null };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const members = (memberships ?? []).map((membership) => ({
    ...membership,
    display_name: profileById.get(membership.user_id)?.display_name ?? null,
  }));

  return <><WorkspaceHeader email={context.user.email ?? ""} role={context.role} workspaces={context.workspaces} /><TeamScreen
    members={members as Parameters<typeof TeamScreen>[0]["members"]}
    invitations={(invitations ?? []) as Parameters<typeof TeamScreen>[0]["invitations"]}
    role={context.role}
  />{(membershipsError || profilesError || invitationsError) && <p className="auth-error team-load-error">Certaines données de l’équipe n’ont pas pu être chargées. Vérifiez que les migrations d’équipe sont appliquées.</p>}</>;
}

export default function TeamPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement de l’équipe…</p></main>}><TeamData /></Suspense>;
}
