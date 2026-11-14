"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/supabase/auth";

export type PlatformAdminActionState = { error?: string; success?: string };

const subscriptionChangeSchema = z.object({
  companyId: z.uuid(),
  planId: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/),
  status: z.enum(["trialing", "active", "past_due", "canceled", "incomplete"]),
});

export async function changeCompanySubscriptionAction(
  _previousState: PlatformAdminActionState,
  formData: FormData,
): Promise<PlatformAdminActionState> {
  const parsed = subscriptionChangeSchema.safeParse({
    companyId: String(formData.get("company_id") ?? ""),
    planId: String(formData.get("plan_id") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!parsed.success) return { error: "Vérifiez le forfait, le statut et l’entreprise sélectionnés." };

  const context = await requirePlatformAdmin();
  const { error } = await context.supabase.rpc("change_company_subscription", {
    p_company_id: parsed.data.companyId,
    p_plan_id: parsed.data.planId,
    p_status: parsed.data.status,
  });
  if (error) {
    console.error("Facturo platform subscription update failed", { code: error.code });
    return { error: "L’abonnement n’a pas pu être modifié. Vérifiez le forfait et réessayez." };
  }

  revalidatePath("/admin");
  return { success: "Abonnement modifié et opération inscrite au journal d’audit." };
}
