import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function requireAuthenticatedCompany() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/sign-in");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", data.user.id).maybeSingle();
  if (!profile?.company_id) redirect("/auth/sign-in");

  return { supabase, user: data.user, companyId: profile.company_id };
}
