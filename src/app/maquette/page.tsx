import { Suspense } from "react";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import MaquetteApp from "@/components/maquette-app";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function AuthenticatedPreview() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/sign-in");

  return <><div className="session-bar"><span>Connecté : {data.user.email}</span><form action={signOutAction}><button className="button small">Se déconnecter</button></form></div><MaquetteApp /></>;
}

export default function MaquettePage() {
  if (!isSupabaseConfigured()) redirect("/");
  return <Suspense fallback={<main className="auth-shell"><p>Chargement de votre espace…</p></main>}><AuthenticatedPreview /></Suspense>;
}
