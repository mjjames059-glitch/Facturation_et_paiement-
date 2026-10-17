import { Suspense } from "react";
import { connection } from "next/server";
import SettingsScreen from "@/components/settings-screen";
import WorkspaceHeader from "@/components/workspace-header";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

async function SettingsData() {
  await connection();
  const { supabase, user } = await requireAuthenticatedCompany();
  const [{ data: company, error: companyError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("companies").select("company_name, legal_name, address, phone, rccm, nif, logo_path").maybeSingle(),
    supabase.from("settings").select("exchange_rate").maybeSingle(),
  ]);
  const logoUrl = company?.logo_path
    ? supabase.storage.from("company-logos").getPublicUrl(company.logo_path).data.publicUrl
    : null;

  return <><WorkspaceHeader email={user.email ?? ""} /><SettingsScreen
    company={company ?? { company_name: "Mon entreprise", legal_name: null, address: null, phone: null, rccm: null, nif: null }}
    logoUrl={logoUrl}
    exchangeRate={String(settings?.exchange_rate ?? "2800").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}
    loadError={Boolean(companyError || settingsError)}
  /></>;
}

export default function SettingsPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement des paramètres…</p></main>}><SettingsData /></Suspense>;
}
