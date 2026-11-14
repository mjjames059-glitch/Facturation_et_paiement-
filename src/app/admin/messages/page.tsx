import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import WorkspaceHeader from "@/components/workspace-header";
import SupportInbox from "@/components/support-inbox";
import { CONTACT_EMAIL } from "@/lib/contact";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

async function SupportMessagesData() {
  await connection();
  const context = await requireAuthenticatedCompany();
  if (context.user.email?.toLowerCase() !== CONTACT_EMAIL.toLowerCase()) {
    redirect("/tableau-de-bord");
  }

  const { data, error } = await context.supabase
    .from("support_messages")
    .select("id, sender_name, sender_email, category, subject, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <WorkspaceHeader email={context.user.email} role={context.role} />
      <SupportInbox messages={data ?? []} loadError={Boolean(error)} />
    </>
  );
}

export default function SupportMessagesPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><p>Chargement des messages…</p></main>}>
      <SupportMessagesData />
    </Suspense>
  );
}
