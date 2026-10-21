import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import InvoiceForm from "@/components/invoice-form";
import WorkspaceHeader from "@/components/workspace-header";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

function todayInKinshasa() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function InvoiceFormData() {
  await connection();
  const { supabase, user, role } = await requireAuthenticatedCompany();
  if (role === "viewer") redirect("/factures");
  const [{ data: clients, error: clientsError }, { data: catalog, error: catalogError }] = await Promise.all([
    supabase.from("clients").select("id, name, client_type").order("name"),
    supabase.from("catalog_items").select("id, name, price_amount, currency, unit").eq("is_active", true).order("name"),
  ]);

  return <><WorkspaceHeader email={user.email ?? ""} role={role} /><InvoiceForm clients={clients ?? []} catalog={catalog ?? []} today={todayInKinshasa()} loadError={Boolean(clientsError || catalogError)} /></>;
}

export default function NewInvoicePage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement du formulaire…</p></main>}><InvoiceFormData /></Suspense>;
}
