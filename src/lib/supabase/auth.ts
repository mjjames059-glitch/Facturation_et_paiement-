import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

  return { supabase, user: data.user, companyId: profile.company_id, role: profile.role, profile };
}
