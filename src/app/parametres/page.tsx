import { Suspense } from "react";
import { connection } from "next/server";
import SettingsScreen from "@/components/settings-screen";
import WorkspaceHeader from "@/components/workspace-header";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

async function SettingsData() {
  await connection();
  const { supabase, user, role, profile, workspaces } = await requireAuthenticatedCompany();
  const [{ data: company, error: companyError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("companies").select("company_name, legal_name, contact_email, address, phone, rccm, nif, logo_path").maybeSingle(),
    supabase.from("settings").select("exchange_rate, brand_primary_color, brand_accent_color, locale, default_currency, invoice_due_days, invoice_footer").maybeSingle(),
  ]);
  const logoUrl = company?.logo_path
    ? supabase.storage.from("company-logos").getPublicUrl(company.logo_path).data.publicUrl
    : null;

  return <><WorkspaceHeader email={user.email ?? ""} role={role} workspaces={workspaces} /><SettingsScreen canManage={role === "owner" || role === "manager"} role={role} email={user.email ?? ""} personalProfile={{ display_name: profile.display_name, phone: profile.phone }}
    company={company ?? { company_name: "Mon entreprise", legal_name: null, contact_email: null, address: null, phone: null, rccm: null, nif: null }}
    logoUrl={logoUrl}
    exchangeRate={String(settings?.exchange_rate ?? "2800").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}
    preferences={{
      brand_primary_color: settings?.brand_primary_color ?? "#2F6B3F",
      brand_accent_color: settings?.brand_accent_color ?? "#EAF3E7",
      locale: settings?.locale ?? "fr-CD",
      default_currency: settings?.default_currency ?? "USD",
      invoice_due_days: settings?.invoice_due_days ?? 30,
      invoice_footer: settings?.invoice_footer ?? "",
    }}
    loadError={Boolean(companyError || settingsError)}
  /></>;
}

export default function SettingsPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement des paramètres…</p></main>}><SettingsData /></Suspense>;
}
