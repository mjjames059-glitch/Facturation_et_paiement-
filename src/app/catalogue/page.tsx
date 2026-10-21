import { Suspense } from "react";
import { connection } from "next/server";
import CatalogScreen from "@/components/catalog-screen";
import WorkspaceHeader from "@/components/workspace-header";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

async function CatalogData() {
  await connection();
  const { supabase, user } = await requireAuthenticatedCompany();
  const { data, error } = await supabase.from("catalog_items")
    .select("id, name, price_amount, currency, unit, is_active")
    .order("name");
  const { data: share } = await supabase.from("catalog_shares").select("token").maybeSingle();
  return <><WorkspaceHeader email={user.email ?? ""} /><CatalogScreen items={data ?? []} loadError={Boolean(error)} shareToken={share?.token ?? null} /></>;
}

export default function CataloguePage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement du catalogue…</p></main>}><CatalogData /></Suspense>;
}
