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

  return <><WorkspaceHeader email={user.email ?? ""} /><CatalogScreen items={data ?? []} loadError={Boolean(error)} /></>;
}

export default function CataloguePage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement du catalogue…</p></main>}><CatalogData /></Suspense>;
}
