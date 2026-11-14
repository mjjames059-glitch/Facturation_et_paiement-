"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

export type WorkspaceActionState = { error?: string };

export async function switchWorkspaceAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const companyId = z.uuid().safeParse(String(formData.get("company_id") ?? ""));
  if (!companyId.success) return { error: "Sélectionnez un espace de travail valide." };

  const context = await requireAuthenticatedCompany();
  if (!context.workspaces.some((workspace) => workspace.company_id === companyId.data)) {
    return { error: "Cet espace n’est pas accessible à votre compte." };
  }

  const { error } = await context.supabase.rpc("set_active_company", {
    p_company_id: companyId.data,
  });
  if (error) {
    console.error("Facturo workspace switch failed", { code: error.code });
    return { error: "Impossible de changer d’espace. Actualisez la page puis réessayez." };
  }

  redirect("/tableau-de-bord");
}
