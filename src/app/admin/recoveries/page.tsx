import { Suspense } from "react";
import { connection } from "next/server";
import AdminPasswordRecoveryInbox, {
  type AdminPasswordRecoveryRequest,
} from "@/components/admin-password-recovery-inbox";
import PlatformAdminHeader from "@/components/platform-admin-header";
import { requirePlatformAdmin } from "@/lib/supabase/auth";

async function AdminRecoveriesContent() {
  await connection();
  const context = await requirePlatformAdmin();
  const { data, error } = await context.supabase
    .from("password_recovery_requests")
    .select("id, email, request_count, requested_at")
    .eq("status", "pending_admin")
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Facturo password recovery queue load failed", { code: error.code });
    throw new Error("Impossible de charger les demandes de récupération.");
  }

  return (
    <>
      <PlatformAdminHeader email={context.user.email ?? ""} themePreference={context.themePreference} />
      <AdminPasswordRecoveryInbox requests={(data ?? []) as AdminPasswordRecoveryRequest[]} />
    </>
  );
}

export default function AdminRecoveriesPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><p>Chargement des demandes de récupération…</p></main>}>
      <AdminRecoveriesContent />
    </Suspense>
  );
}
