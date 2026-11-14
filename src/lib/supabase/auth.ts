import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type CompanyWorkspace = {
  company_id: string;
  company_name: string;
  logo_path: string | null;
  role: "owner" | "manager" | "accountant" | "collaborator" | "viewer";
  is_current: boolean;
  brand_primary_color: string;
  brand_accent_color: string;
};

export async function requireAuthenticatedCompany() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.error("Facturo dashboard auth check failed", { code: error?.code ?? "no_user" });
    redirect("/auth/confirmation?status=session");
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("company_id, role, display_name, phone").eq("user_id", data.user.id).maybeSingle();
  if (profileError || !profile?.company_id) {
    console.error("Facturo dashboard profile check failed", { code: profileError?.code ?? "no_profile" });
    redirect("/auth/confirmation?status=profile");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_memberships")
    .select("role")
    .eq("company_id", profile.company_id)
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    console.error("Facturo active company membership check failed", {
      code: membershipError?.code ?? "no_membership",
    });
    redirect("/auth/confirmation?status=profile");
  }

  const { data: workspaces, error: workspacesError } = await supabase.rpc("list_my_company_workspaces");
  if (workspacesError) {
    console.error("Facturo workspace list failed", { code: workspacesError.code });
    throw new Error("Impossible de charger les espaces de travail de ce compte.");
  }

  return {
    supabase,
    user: data.user,
    companyId: profile.company_id,
    role: membership.role,
    profile,
    workspaces: (workspaces ?? []) as CompanyWorkspace[],
  };
}

export async function requirePlatformAdmin() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/auth/sign-in");
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError) {
    console.error("Facturo platform admin check failed", { code: adminError.code });
    throw new Error("Impossible de vérifier les autorisations administrateur.");
  }
  if (!isAdmin) redirect("/tableau-de-bord");

  return { supabase, user: data.user };
}
