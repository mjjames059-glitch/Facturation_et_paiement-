import { Suspense } from "react";
import { connection } from "next/server";
import PlatformAdminHeader from "@/components/platform-admin-header";
import SupportInbox from "@/components/support-inbox";
import { requirePlatformAdmin } from "@/lib/supabase/auth";

async function SupportMessagesData() {
  await connection();
  const context = await requirePlatformAdmin();

  const { data, error } = await context.supabase
    .from("support_messages")
    .select("id, sender_name, sender_email, category, subject, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PlatformAdminHeader email={context.user.email ?? ""} />
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
