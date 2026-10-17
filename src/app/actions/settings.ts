"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseExchangeRateUnits } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SettingsActionState = { error?: string; success?: string };

async function currentCompany() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return { supabase, companyId: null };
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", userData.user.id).maybeSingle();
  return { supabase, companyId: profile?.company_id ?? null };
}

const companySchema = z.object({
  legalName: z.string().trim().max(160),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  rccm: z.string().trim().max(80),
  nif: z.string().trim().max(80),
});

export async function updateCompanyProfileAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const parsed = companySchema.safeParse({
    legalName: String(formData.get("legal_name") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    rccm: String(formData.get("rccm") ?? ""),
    nif: String(formData.get("nif") ?? ""),
  });
  if (!parsed.success) return { error: "Vérifiez les champs du profil." };

  const context = await currentCompany();
  if (!context.companyId) return { error: "Connectez-vous avant de modifier le profil." };
  const { error } = await context.supabase.from("companies").update({
    legal_name: parsed.data.legalName || null,
    address: parsed.data.address || null,
    phone: parsed.data.phone || null,
    rccm: parsed.data.rccm || null,
    nif: parsed.data.nif || null,
  }).eq("id", context.companyId);
  if (error) return { error: "Le profil n’a pas pu être mis à jour." };

  revalidatePath("/parametres");
  revalidatePath("/tableau-de-bord");
  return { success: "Profil entreprise enregistré." };
}

const logoSchema = z.instanceof(File)
  .refine((file) => file.size > 0 && file.size <= 2 * 1024 * 1024, "Le logo doit faire moins de 2 Mo.")
  .refine((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type), "Format accepté : PNG, JPEG ou WebP.");

export async function uploadCompanyLogoAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const file = logoSchema.safeParse(formData.get("logo"));
  if (!file.success) return { error: file.error.issues[0]?.message ?? "Sélectionnez un fichier image valide." };

  const context = await currentCompany();
  if (!context.companyId) return { error: "Connectez-vous avant d’ajouter un logo." };
  const extension = file.data.type === "image/png" ? "png" : file.data.type === "image/webp" ? "webp" : "jpg";
  const path = `${context.companyId}/${globalThis.crypto.randomUUID()}.${extension}`;
  const { data: company } = await context.supabase.from("companies").select("logo_path").eq("id", context.companyId).maybeSingle();
  const { error: uploadError } = await context.supabase.storage.from("company-logos").upload(path, new Uint8Array(await file.data.arrayBuffer()), {
    contentType: file.data.type,
    upsert: false,
  });
  if (uploadError) return { error: "Le logo n’a pas pu être téléversé." };

  const { error: updateError } = await context.supabase.from("companies").update({ logo_path: path }).eq("id", context.companyId);
  if (updateError) {
    await context.supabase.storage.from("company-logos").remove([path]);
    return { error: "Le profil n’a pas pu être mis à jour avec ce logo." };
  }

  if (company?.logo_path?.startsWith(`${context.companyId}/`)) {
    await context.supabase.storage.from("company-logos").remove([company.logo_path]);
  }
  revalidatePath("/parametres");
  revalidatePath("/f/[token]", "page");
  return { success: "Logo mis à jour." };
}

const exchangeRateSchema = z.string().trim().regex(/^\d{1,10}(?:[.,]\d{1,4})?$/, "Saisissez un taux valide.");

export async function updateExchangeRateAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const parsed = exchangeRateSchema.safeParse(String(formData.get("exchange_rate") ?? ""));
  if (!parsed.success || parseExchangeRateUnits(parsed.data ?? "") === null) return { error: "Le taux de change doit être un nombre supérieur à zéro." };

  const context = await currentCompany();
  if (!context.companyId) return { error: "Connectez-vous avant de modifier le taux." };
  const { error } = await context.supabase.from("settings").upsert({
    company_id: context.companyId,
    exchange_rate: parsed.data.replace(",", "."),
  }, { onConflict: "company_id" });
  if (error) return { error: "Le taux de change n’a pas pu être enregistré." };

  revalidatePath("/parametres");
  revalidatePath("/tableau-de-bord");
  return { success: "Taux de change enregistré." };
}
