import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { signOutPlatformAdminAction } from "@/app/actions/auth";
import { SignInForm } from "@/components/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Connexion administrateur | Facturo",
  description: "Connexion sécurisée à l’administration de la plateforme Facturo.",
};

type AdminLoginPageProps = { searchParams: Promise<{ notice?: string }> };

async function AdminLoginContent({ searchParams }: AdminLoginPageProps) {
  await connection();
  const [{ notice }, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const isMissingSession = authError?.name === "AuthSessionMissingError";
  if (authError && !isMissingSession) {
    console.error("Facturo administrator login session check failed", { code: authError.code });
    throw new Error("Impossible de vérifier la session administrateur.");
  }

  let signedInAsNonAdmin = false;
  if (authData.user) {
    const { data: isPlatformAdmin, error: adminError } = await supabase.rpc("is_platform_admin");
    if (adminError) {
      console.error("Facturo administrator login authorization check failed", { code: adminError.code });
      throw new Error("Impossible de vérifier l’autorisation administrateur.");
    }
    if (isPlatformAdmin) redirect("/admin");
    signedInAsNonAdmin = true;
  }

  return (
    <main className="auth-shell signin-shell">
      <div className="signin-layout admin-signin-layout">
        <section className="signin-intro">
          <Link href="/" className="brand">Facturo<small>Administration de la plateforme</small></Link>
          <p className="eyebrow">Accès réservé</p>
          <h1>Administration Facturo.</h1>
          <p>Cette connexion est réservée aux comptes autorisés à gérer les entreprises et abonnements de la plateforme.</p>
          <ul><li>Gestion des entreprises clientes</li><li>Suivi des abonnements et usages</li><li>Accès protégé et opérations journalisées</li></ul>
        </section>
        <section className="auth-card signin-card">
          <p className="eyebrow">Espace administrateur</p>
          <h2>Connexion administrateur</h2>
          <p className="lead">Connectez-vous avec le compte explicitement autorisé par Facturo.</p>
          {notice === "unauthorized" && <p className="auth-error" role="alert">Ce compte n’a pas accès à l’administration de la plateforme.</p>}
          {signedInAsNonAdmin && <>
            <p className="auth-error" role="alert">Votre session actuelle est une session client, sans autorisation administrateur. Déconnectez-vous avant d’utiliser un autre compte.</p>
            <form action={signOutPlatformAdminAction}><button className="button">Se déconnecter</button></form>
          </>}
          {!signedInAsNonAdmin && <SignInForm audience="platform-admin" />}
        </section>
      </div>
    </main>
  );
}

export default function AdminLoginPage(props: AdminLoginPageProps) {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement de la connexion administrateur…</p></main>}><AdminLoginContent {...props} /></Suspense>;
}
