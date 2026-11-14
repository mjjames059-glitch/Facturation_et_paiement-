import { Suspense } from "react";
import { connection } from "next/server";
import PlatformAdminHeader from "@/components/platform-admin-header";
import PlatformAdminScreen, {
  type PlatformAuditEvent,
  type PlatformCompany,
  type PlatformPlan,
} from "@/components/platform-admin-screen";
import { requirePlatformAdmin } from "@/lib/supabase/auth";

type AdminPageProps = { searchParams: Promise<{ q?: string; status?: string; plan?: string; page?: string }> };

async function AdminContent({ searchParams }: AdminPageProps) {
  await connection();
  const { q = "", status = "", plan = "", page: pageText = "0" } = await searchParams;
  const context = await requirePlatformAdmin();
  const page = /^\d{1,5}$/.test(pageText) ? Math.min(Number(pageText), 10000) : 0;
  const [{ data: companiesData, error: companiesError }, { data: plansData, error: plansError }, { data: auditData, error: auditError }] = await Promise.all([
    context.supabase.rpc("list_platform_companies", {
      p_search: q.trim().slice(0, 120) || null,
      p_status: status || null,
      p_plan_id: plan || null,
      p_limit: 50,
      p_offset: page * 50,
    }),
    context.supabase.from("subscription_plans").select("id, name").eq("is_active", true).order("id"),
    context.supabase.rpc("list_platform_audit_events", { p_limit: 50 }),
  ]);
  if (companiesError || plansError || auditError) {
    console.error("Facturo platform administration data load failed", {
      companies: companiesError?.code,
      plans: plansError?.code,
      audit: auditError?.code,
    });
    throw new Error("Impossible de charger les données d’administration de la plateforme.");
  }

  const companies = (companiesData ?? []) as PlatformCompany[];
  return (
    <>
      <PlatformAdminHeader email={context.user.email ?? ""} />
      <PlatformAdminScreen
        companies={companies}
        plans={(plansData ?? []) as PlatformPlan[]}
        auditEvents={(auditData ?? []) as PlatformAuditEvent[]}
        search={q}
        status={status}
        planId={plan}
        page={page}
        hasMore={companies.length === 50}
      />
    </>
  );
}

export default function PlatformAdminPage(props: AdminPageProps) {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement de l’administration…</p></main>}><AdminContent {...props} /></Suspense>;
}
