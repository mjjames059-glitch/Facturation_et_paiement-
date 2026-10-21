import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvitationRegistrationForm } from "@/components/auth-form";

type PageProps = { searchParams: Promise<{ token?: string }> };

async function InvitationContent({ searchParams }: PageProps) {
  await connection();
  const { token = "" } = await searchParams;
  const validToken = /^[a-f0-9]{64}$/.test(token);
  let invitation: { company_name: string; invited_email: string; invited_role: string } | null = null;
  if (validToken) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.rpc("lookup_company_invitation", { p_token: token });
      invitation = data?.[0] ?? null;
    } catch {
      invitation = null;
    }
  }

  const roleLabels: Record<string, string> = {
    manager: "Gestionnaire",
    accountant: "Comptable",
    collaborator: "Collaborateur",
    viewer: "Lecture seule",
  };

  return (
    <main className="auth-shell signin-shell">
      <section className="auth-card confirmation-card">
        <Link href="/" className="brand">Facturo<small>Facturation et suivi des paiements</small></Link>
        {invitation ? <>
          <div className="confirmation-icon" aria-hidden="true">↗</div>
          <p className="eyebrow">Invitation d’équipe</p>
          <h1>Rejoindre {invitation.company_name}</h1>
          <p className="lead">Vous êtes invité comme <b>{roleLabels[invitation.invited_role] ?? "Collaborateur"}</b>. Créez votre accès avec l’adresse à laquelle l’invitation a été envoyée.</p>
          <InvitationRegistrationForm token={token} email={invitation.invited_email} />
        </> : <>
          <div className="confirmation-icon" aria-hidden="true">!</div>
          <p className="eyebrow">Invitation indisponible</p>
          <h1>Ce lien est invalide ou expiré</h1>
          <p className="lead">Demandez au propriétaire de l’entreprise de créer une nouvelle invitation. Chaque lien est à usage unique et expire après 48 heures.</p>
          <p className="auth-switch"><Link href="/auth/sign-in">Retour à la connexion</Link></p>
        </>}
      </section>
    </main>
  );
}

export default function InvitationPage(props: PageProps) {
  return <Suspense fallback={<main className="auth-shell"><p>Vérification de l’invitation…</p></main>}><InvitationContent {...props} /></Suspense>;
}
