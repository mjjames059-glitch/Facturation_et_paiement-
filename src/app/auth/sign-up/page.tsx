import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { GoogleCompanyRegistrationForm, SignUpForm } from "@/components/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { searchParams: Promise<{ mode?: string }> };

function SignUpCard({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return <main className="auth-shell">
    <section className="auth-card auth-card-wide">
      <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
      {children}
      <p className="auth-switch">Vous avez déjà un compte ? <Link href="/auth/sign-in">Se connecter</Link></p>
    </section>
  </main>;
}

async function SignUpContent({ searchParams }: PageProps) {
  const { mode } = await searchParams;
  if (mode !== "google") {
    return <SignUpCard title="Créer votre compte" description="Quelques informations pour adapter l’outil à votre activité."><SignUpForm /></SignUpCard>;
  }

  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/auth/sign-in");

  const { data: profile, error } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
  if (profile?.company_id) redirect("/tableau-de-bord");
  if (error) redirect("/auth/confirmation?status=profile");

  const metadata = user.user_metadata as Record<string, unknown>;
  const displayName = [metadata.full_name, metadata.name].find((value): value is string => typeof value === "string") ?? "";
  return <SignUpCard title="Compléter votre inscription" description="Google a vérifié vos informations personnelles. Ajoutez les renseignements de votre entreprise pour créer votre espace Facturo.">
    <GoogleCompanyRegistrationForm email={user.email ?? ""} displayName={displayName} />
  </SignUpCard>;
}

export default function SignUpPage(props: PageProps) {
  return <Suspense fallback={<main className="auth-shell"><section className="auth-card auth-card-wide"><p className="eyebrow">Préparation de votre inscription…</p></section></main>}><SignUpContent {...props} /></Suspense>;
}
