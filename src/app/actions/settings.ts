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
  companyName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160),
  contactEmail: z.union([z.email().max(254), z.literal("")]),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  rccm: z.string().trim().max(80),
  nif: z.string().trim().max(80),
});

const personalProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(40),
});

export async function updatePersonalProfileAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const parsed = personalProfileSchema.safeParse({
    displayName: String(formData.get("display_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!parsed.success) return { error: "Le nom doit contenir au moins 2 caractères. Vérifiez aussi le téléphone." };

  const context = await currentCompany();
  if (!context.companyId) return { error: "Connectez-vous avant de modifier votre profil." };
  const { data: userData } = await context.supabase.auth.getUser();
  if (!userData.user) return { error: "Votre session a expiré. Reconnectez-vous puis réessayez." };
  const { error } = await context.supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    phone: parsed.data.phone || null,
  }).eq("user_id", userData.user.id);
  if (error) return { error: "Votre profil n’a pas pu être mis à jour." };
  revalidatePath("/parametres");
  return { success: "Votre profil personnel a été enregistré." };
}

export async function updatePersonalEmailAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const parsedEmail = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsedEmail.success) return { error: "Saisissez une adresse e-mail valide." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.updateUser({ email: parsedEmail.data });
    if (error || !data.user) return { error: "L’adresse e-mail n’a pas pu être modifiée. Vérifiez-la puis réessayez." };
    return { success: "Un e-mail de confirmation a été envoyé à la nouvelle adresse." };
  } catch {
    return { error: "La modification de l’adresse e-mail est indisponible. Réessayez dans un instant." };
  }
}

export async function updateCompanyProfileAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const parsed = companySchema.safeParse({
    companyName: String(formData.get("company_name") ?? ""),
    legalName: String(formData.get("legal_name") ?? ""),
    contactEmail: String(formData.get("contact_email") ?? "").trim().toLowerCase(),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    rccm: String(formData.get("rccm") ?? ""),
    nif: String(formData.get("nif") ?? ""),
  });
  if (!parsed.success) return { error: "Vérifiez les champs du profil." };

  const context = await currentCompany();
  if (!context.companyId) return { error: "Connectez-vous avant de modifier le profil." };
  const { error } = await context.supabase.from("companies").update({
    company_name: parsed.data.companyName,
    legal_name: parsed.data.legalName || null,
    contact_email: parsed.data.contactEmail || null,
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

const workspacePreferencesSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  locale: z.enum(["fr-CD", "fr-FR", "en-US"]),
  defaultCurrency: z.enum(["USD", "CDF"]),
  invoiceDueDays: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(0).max(365)),
  invoiceFooter: z.string().trim().max(2000),
});

export async function updateWorkspacePreferencesAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const parsed = workspacePreferencesSchema.safeParse({
    primaryColor: String(formData.get("brand_primary_color") ?? ""),
    accentColor: String(formData.get("brand_accent_color") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    defaultCurrency: String(formData.get("default_currency") ?? ""),
    invoiceDueDays: String(formData.get("invoice_due_days") ?? ""),
    invoiceFooter: String(formData.get("invoice_footer") ?? ""),
  });
  if (!parsed.success) return { error: "Vérifiez les couleurs, la langue, la devise et le délai de paiement." };

  const context = await currentCompany();
  if (!context.companyId) return { error: "Connectez-vous avant de modifier les préférences." };
  const { error } = await context.supabase.from("settings").upsert({
    company_id: context.companyId,
    brand_primary_color: parsed.data.primaryColor,
    brand_accent_color: parsed.data.accentColor,
    locale: parsed.data.locale,
    default_currency: parsed.data.defaultCurrency,
    invoice_due_days: parsed.data.invoiceDueDays,
    invoice_footer: parsed.data.invoiceFooter || null,
  }, { onConflict: "company_id" });
  if (error) {
    console.error("Facturo workspace preferences update failed", { code: error.code });
    return { error: "Les préférences de l’espace n’ont pas pu être enregistrées." };
  }

  revalidatePath("/parametres");
  revalidatePath("/tableau-de-bord");
  revalidatePath("/factures");
  revalidatePath("/f/[token]", "page");
  return { success: "Préférences de l’espace enregistrées." };
}

const logoSchema = z.instanceof(File)
  .refine((file) => file.size > 0 && file.size <= 2 * 1024 * 1024, "Le logo doit faire moins de 2 Mo.")
  .refine((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type), "Format accepté : PNG, JPEG ou WebP.");

function imageSignatureMatches(fileType: string, bytes: Uint8Array) {
  if (fileType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  }
  if (fileType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (fileType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function uploadCompanyLogoAction(_previousState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const file = logoSchema.safeParse(formData.get("logo"));
  if (!file.success) return { error: file.error.issues[0]?.message ?? "Sélectionnez un fichier image valide." };
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  if (!imageSignatureMatches(file.data.type, bytes)) return { error: "Le contenu du fichier ne correspond pas à un PNG, JPEG ou WebP valide." };

  const context = await currentCompany();
  if (!context.companyId) return { error: "Connectez-vous avant d’ajouter un logo." };
  const extension = file.data.type === "image/png" ? "png" : file.data.type === "image/webp" ? "webp" : "jpg";
  const path = `${context.companyId}/${globalThis.crypto.randomUUID()}.${extension}`;
  const { data: company } = await context.supabase.from("companies").select("logo_path").eq("id", context.companyId).maybeSingle();
  const { error: uploadError } = await context.supabase.storage.from("company-logos").upload(path, bytes, {
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
  const exchangeRate = parsed.data.replace(",", ".");
  const { data: updatedSetting, error: updateError } = await context.supabase
    .from("settings")
    .update({ exchange_rate: exchangeRate })
    .eq("company_id", context.companyId)
    .select("exchange_rate")
    .maybeSingle();
  if (updateError) {
    console.error("Facturo exchange rate update failed", { code: updateError.code, message: updateError.message });
    return { error: "Le taux de change n’a pas pu être enregistré. Vérifiez vos autorisations puis réessayez." };
  }

  let savedSetting = updatedSetting;
  if (!savedSetting) {
    const { data: insertedSetting, error: insertError } = await context.supabase
      .from("settings")
      .insert({ company_id: context.companyId, exchange_rate: exchangeRate })
      .select("exchange_rate")
      .maybeSingle();
    if (insertError) {
      console.error("Facturo exchange rate insert failed", { code: insertError.code, message: insertError.message });
      return { error: "Le taux de change n’a pas pu être enregistré. Vérifiez vos autorisations puis réessayez." };
    }
    savedSetting = insertedSetting;
  }
  if (!savedSetting) return { error: "Le taux de change n’a pas été confirmé par la base de données. Réessayez." };

  revalidatePath("/parametres");
  revalidatePath("/tableau-de-bord");
  const savedRate = String(savedSetting.exchange_rate).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return { success: `Taux enregistré : 1 USD = ${savedRate} CDF.` };
}
