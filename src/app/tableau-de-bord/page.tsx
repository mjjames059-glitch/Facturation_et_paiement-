import { Suspense } from "react";
import { connection } from "next/server";
import DashboardScreen, { type DashboardLateInvoice } from "@/components/dashboard-screen";
import WorkspaceHeader from "@/components/workspace-header";
import { toUsdCents, parseExchangeRateUnits, type CurrencyCode } from "@/lib/money";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

type InvoiceRow = {
  id: string;
  client_id: string;
  invoice_number: string;
  currency: CurrencyCode;
  issued_at: string;
  due_date: string;
  total_amount: string;
  paid_amount: string;
  stored_status: "draft" | "sent" | "paid";
  effective_status: "draft" | "sent" | "paid" | "overdue";
};

function todayInKinshasa() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function displayRate(value: string | number) {
  return String(value).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

async function DashboardData() {
  await connection();
  const { supabase, user, role } = await requireAuthenticatedCompany();
  const [invoiceResult, clientResult, companyResult, settingsResult, tokenResult] = await Promise.all([
    supabase.from("invoice_status_summary").select("id, client_id, invoice_number, currency, issued_at, due_date, total_amount, paid_amount, stored_status, effective_status").order("issued_at", { ascending: false }),
    supabase.from("clients").select("id, name, client_type, whatsapp_phone"),
    supabase.from("companies").select("company_name, legal_name").maybeSingle(),
    supabase.from("settings").select("exchange_rate").maybeSingle(),
    supabase.from("invoices").select("id, public_token"),
  ]);

  const invoices = (invoiceResult.data ?? []) as InvoiceRow[];
  const clients = clientResult.data ?? [];
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const tokens = new Map((tokenResult.data ?? []).map((row) => [row.id, row.public_token]));
  const rateText = displayRate(settingsResult.data?.exchange_rate ?? "2800");
  const rateUnits = parseExchangeRateUnits(rateText) ?? parseExchangeRateUnits("2800")!;

  let billed = BigInt(0);
  let collected = BigInt(0);
  let overdueOutstanding = BigInt(0);
  const breakdown = { b2b: BigInt(0), b2a: BigInt(0), b2c: BigInt(0) };
  const lateInvoices: DashboardLateInvoice[] = [];

  for (const invoice of invoices) {
    if (invoice.stored_status === "draft") continue;
    const total = toUsdCents(invoice.total_amount, invoice.currency, rateUnits);
    const paid = toUsdCents(invoice.paid_amount, invoice.currency, rateUnits);
    const remaining = total > paid ? total - paid : BigInt(0);
    billed += total;
    collected += paid;

    const client = clientById.get(invoice.client_id);
    if (client?.client_type === "b2b") breakdown.b2b += total;
    else if (client?.client_type === "b2a") breakdown.b2a += total;
    else breakdown.b2c += total;

    if (invoice.effective_status === "overdue") {
      overdueOutstanding += remaining;
      lateInvoices.push({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: client?.name ?? "Client",
        clientPhone: client?.whatsapp_phone ?? "",
        amountDue: (BigInt(invoice.total_amount) - BigInt(invoice.paid_amount)).toString(),
        currency: invoice.currency,
        dueDate: invoice.due_date,
        token: tokens.get(invoice.id) ?? "",
      });
    }
  }

  const outstanding = billed > collected ? billed - collected : BigInt(0);
  const paidShare = billed > BigInt(0) ? Number((collected * BigInt(100)) / billed) : 0;
  const lateShare = billed > BigInt(0) ? Number((overdueOutstanding * BigInt(100)) / billed) : 0;
  const pendingShare = billed > BigInt(0) ? Math.max(0, 100 - paidShare - lateShare) : 0;
  const companyName = companyResult.data?.legal_name || companyResult.data?.company_name || "votre entreprise";
  const loadError = Boolean(invoiceResult.error || clientResult.error || companyResult.error || settingsResult.error || tokenResult.error);

  return <><WorkspaceHeader email={user.email ?? ""} role={role} /><DashboardScreen role={role}
    companyName={companyName}
    billed={billed.toString()}
    collected={collected.toString()}
    outstanding={outstanding.toString()}
    overduePercent={lateShare}
    pendingPercent={pendingShare}
    paidPercent={paidShare}
    breakdown={{ b2b: breakdown.b2b.toString(), b2a: breakdown.b2a.toString(), b2c: breakdown.b2c.toString() }}
    clientsCount={clients.length}
    lateInvoices={lateInvoices}
    today={todayInKinshasa()}
    exchangeRate={rateText}
    loadError={loadError}
  /></>;
}

export default function DashboardPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Chargement du tableau de bord…</p></main>}><DashboardData /></Suspense>;
}
