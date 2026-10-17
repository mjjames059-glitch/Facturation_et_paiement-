import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function SessionGate(): Promise<ReactNode> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/tableau-de-bord" : "/auth/sign-in");
  return null;
}

export default function Home() {
  if (isSupabaseConfigured()) {
    return <Suspense fallback={<main className="auth-shell"><p>Chargement…</p></main>}><SessionGate /></Suspense>;
  }

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
