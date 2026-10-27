import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function HomeContent({ searchParams }: PageProps): Promise<never> {
  await connection();
  const params = await searchParams;

  // Supabase may land the browser on the site URL with the authorization code
  // when the requested redirect URL is not allow listed. Hand it over to the
  // callback route instead of dropping it.
  const code = firstParam(params.code);
  const oauthError = firstParam(params.error);
  if (code || oauthError) {
    const query = new URLSearchParams();
    if (code) query.set("code", code);
    if (oauthError) query.set("error", oauthError);
    for (const key of ["error_code", "error_description", "state", "sb_flow_id"]) {
      const value = firstParam(params[key]);
      if (value) query.set(key, value);
    }
    redirect(`/auth/callback?${query.toString()}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/tableau-de-bord" : "/auth/sign-in");
}

export default function Home({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Facturo</h1>
          <p className="lead">Pour commencer, configurez votre projet Supabase dans le fichier <code>.env.local</code>.</p>
          <p>Copiez les valeurs de <code>.env.example</code>, puis appliquez les migrations du dossier <code>supabase/migrations</code>.</p>
          <div className="actions"><Link className="button primary" href="/auth/sign-up">Créer un compte</Link><Link className="button" href="/auth/sign-in">Se connecter</Link></div>
        </section>
      </main>
    );
  }

  return (
    <Suspense fallback={<main className="auth-shell"><p>Chargement…</p></main>}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
