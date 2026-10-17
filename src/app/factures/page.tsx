import { Suspense } from "react";
import { connection } from "next/server";
import InvoicesScreen, { type InvoiceSummary } from "@/components/invoices-screen";
import WorkspaceHeader from "@/components/workspace-header";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

function todayInKinshasa() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function InvoiceData() {
  await connection();
  const { supabase, user } = await requireAuthenticatedCompany();
  const { data, error } = await supabase.from("invoice_status_summary").select("id, client_id, invoice_number, currency, issued_at, due_date, total_amount, paid_amount, effective_status").order("issued_at", { ascending: false });
  const invoices = (data ?? []) as InvoiceSummary[];
  const clientIds = [...new Set(invoices.map((invoice) => invoice.client_id))];
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const [{ data: clients, error: clientsError }, { data: tokens, error: tokensError }] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, name, whatsapp_phone").in("id", clientIds) : Promise.resolve({ data: [], error: null }),
    invoiceIds.length ? supabase.from("invoices").select("id, public_token").in("id", invoiceIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const clientNames = Object.fromEntries((clients ?? []).map((client) => [client.id, client.name]));
  const clientPhones = Object.fromEntries((clients ?? []).map((client) => [client.id, client.whatsapp_phone ?? ""]));
  const publicTokens = Object.fromEntries((tokens ?? []).map((invoice) => [invoice.id, invoice.public_token]));
  for (const invoice of invoices) invoice.public_token = publicTokens[invoice.id] ?? "";

  return <><WorkspaceHeader email={user.email ?? ""} /><InvoicesScreen invoices={invoices} clientNames={clientNames} clientPhones={clientPhones} today={todayInKinshasa()} loadError={Boolean(error || clientsError || tokensError)} /></>;
}

export default function InvoicesPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement des factures…</p></main>}><InvoiceData /></Suspense>;
}
