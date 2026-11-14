"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/supabase/auth";

export type PlatformAdminActionState = { error?: string; success?: string };

const subscriptionChangeSchema = z.object({
  companyId: z.uuid(),
  planId: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/),
  status: z.enum(["trialing", "active", "past_due", "canceled", "incomplete", "suspended"]),
  currentPeriodEnd: z.iso.date().nullable(),
  trialEndsAt: z.iso.date().nullable(),
});

export async function changeCompanySubscriptionAction(
  _previousState: PlatformAdminActionState,
  formData: FormData,
): Promise<PlatformAdminActionState> {
  const parsed = subscriptionChangeSchema.safeParse({
    companyId: String(formData.get("company_id") ?? ""),
    planId: String(formData.get("plan_id") ?? ""),
    status: String(formData.get("status") ?? ""),
    currentPeriodEnd: String(formData.get("current_period_end") ?? "") || null,
    trialEndsAt: String(formData.get("trial_ends_at") ?? "") || null,
  });
  if (!parsed.success) return { error: "Vérifiez le forfait, le statut et les dates saisis." };
  if (parsed.data.status === "trialing" && !parsed.data.trialEndsAt) {
    return { error: "Indiquez la date de fin de l’essai." };
  }

  const context = await requirePlatformAdmin();
  const { error } = await context.supabase.rpc("change_company_subscription", {
    p_company_id: parsed.data.companyId,
    p_plan_id: parsed.data.planId,
    p_status: parsed.data.status,
    p_current_period_end: parsed.data.currentPeriodEnd,
    p_trial_ends_at: parsed.data.trialEndsAt,
  });
  if (error) {
    console.error("Facturo platform subscription update failed", { code: error.code });
    return { error: "L’abonnement n’a pas pu être modifié. Vérifiez le forfait et réessayez." };
  }

  revalidatePath("/admin");
  return { success: "Abonnement modifié et opération inscrite au journal d’audit." };
}

const subscriptionPaymentSchema = z.object({
  companyId: z.uuid(),
  paidAt: z.iso.date(),
  paidThrough: z.iso.date(),
  reference: z.string().trim().max(200),
});

export async function recordSubscriptionPaymentAction(
  _previousState: PlatformAdminActionState,
  formData: FormData,
): Promise<PlatformAdminActionState> {
  const parsed = subscriptionPaymentSchema.safeParse({
    companyId: String(formData.get("company_id") ?? ""),
    paidAt: String(formData.get("paid_at") ?? ""),
    paidThrough: String(formData.get("paid_through") ?? ""),
    reference: String(formData.get("reference") ?? ""),
  });
  if (!parsed.success || parsed.data.paidThrough <= parsed.data.paidAt) {
    return { error: "Vérifiez la date de paiement et la date jusqu’à laquelle l’abonnement est payé." };
  }

  const context = await requirePlatformAdmin();
  const { error } = await context.supabase.rpc("record_subscription_payment", {
    p_company_id: parsed.data.companyId,
    p_paid_at: parsed.data.paidAt,
    p_paid_through: parsed.data.paidThrough,
    p_reference: parsed.data.reference || null,
  });
  if (error) {
    console.error("Facturo platform subscription payment recording failed", { code: error.code });
    return { error: "Le paiement n’a pas pu être enregistré. Vérifiez les dates et réessayez." };
  }

  revalidatePath("/admin");
  return { success: "Paiement enregistré et ajouté à l’historique d’audit." };
}

const planLimitsSchema = z.object({
  planId: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/),
  maxMembers: z.number().int().min(1).nullable(),
  maxClients: z.number().int().min(0).nullable(),
  maxCatalogItems: z.number().int().min(0).nullable(),
  maxMonthlyInvoices: z.number().int().min(0).nullable(),
  maxDailyInvoices: z.number().int().min(0).nullable(),
});

function readLimit(value: FormDataEntryValue | null): number | null | undefined {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return undefined;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export async function updateSubscriptionPlanLimitsAction(
  _previousState: PlatformAdminActionState,
  formData: FormData,
): Promise<PlatformAdminActionState> {
  const limits = {
    maxMembers: readLimit(formData.get("max_members")),
    maxClients: readLimit(formData.get("max_clients")),
    maxCatalogItems: readLimit(formData.get("max_catalog_items")),
    maxMonthlyInvoices: readLimit(formData.get("max_monthly_invoices")),
    maxDailyInvoices: readLimit(formData.get("max_daily_invoices")),
  };
  if (Object.values(limits).some((value) => value === undefined)) {
    return { error: "Saisissez des limites entières positives ou laissez le champ vide pour illimité." };
  }

  const parsed = planLimitsSchema.safeParse({
    planId: String(formData.get("plan_id") ?? ""),
    ...limits,
  });
  if (!parsed.success) return { error: "Vérifiez les limites configurées pour ce forfait." };

  const context = await requirePlatformAdmin();
  const { error } = await context.supabase.rpc("update_subscription_plan_limits", {
    p_plan_id: parsed.data.planId,
    p_max_members: parsed.data.maxMembers,
    p_max_clients: parsed.data.maxClients,
    p_max_catalog_items: parsed.data.maxCatalogItems,
    p_max_monthly_invoices: parsed.data.maxMonthlyInvoices,
    p_max_daily_invoices: parsed.data.maxDailyInvoices,
  });
  if (error) {
    console.error("Facturo subscription plan limits update failed", { code: error.code });
    return { error: "Les limites du forfait n’ont pas pu être enregistrées." };
  }

  revalidatePath("/admin");
  return { success: "Limites du forfait modifiées et inscrites au journal d’audit." };
}
