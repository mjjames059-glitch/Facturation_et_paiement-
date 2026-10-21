"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormActionState = { error?: string; success?: string };

async function getCompanyId() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return { supabase, companyId: null };

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", userData.user.id).maybeSingle();
  return { supabase, companyId: profile?.company_id ?? null };
}

const clientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientType: z.enum(["b2b", "b2a", "b2c"]),
  whatsappPhone: z.string().trim().max(40),
  email: z.union([z.email().max(254), z.literal("")]),
  address: z.string().trim().max(300),
  nif: z.string().trim().max(80),
}).superRefine((data, context) => {
  if (data.clientType !== "b2c" && !data.nif) {
    context.addIssue({ code: "custom", path: ["nif"], message: "Le NIF est obligatoire pour ce type de client." });
  }
});

export async function createClientAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = clientSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    clientType: String(formData.get("client_type") ?? ""),
    whatsappPhone: String(formData.get("whatsapp_phone") ?? ""),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? ""),
    nif: String(formData.get("nif") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez les champs du formulaire." };

  let context;
  try {
    context = await getCompanyId();
  } catch {
    return { error: "Connexion Supabase indisponible. Réessayez dans un instant." };
  }
  if (!context.companyId) return { error: "Connectez-vous avant d’ajouter un client." };

  const { error } = await context.supabase.from("clients").insert({
    company_id: context.companyId,
    name: parsed.data.name,
    client_type: parsed.data.clientType,
    whatsapp_phone: parsed.data.whatsappPhone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    nif: parsed.data.nif || null,
  });
  if (error) return { error: "Le client n’a pas pu être enregistré. Vérifiez ses informations puis réessayez." };

  revalidatePath("/clients");
  return { success: "Client ajouté." };
}

const catalogSchema = z.object({
  name: z.string().trim().min(2).max(160),
  price: z.string().trim().regex(/^\d{1,14}(?:\.\d{1,2})?$/, "Saisissez un prix valide."),
  currency: z.enum(["USD", "CDF"]),
  unit: z.string().trim().min(1).max(40),
});

export async function createCatalogItemAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = catalogSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    price: String(formData.get("price") ?? "").replace(",", "."),
    currency: String(formData.get("currency") ?? ""),
    unit: String(formData.get("unit") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez les champs du formulaire." };
  if (parsed.data.currency === "CDF" && parsed.data.price.includes(".")) return { error: "Le prix en CDF doit être un nombre entier." };

  const [whole, fraction = ""] = parsed.data.price.split(".");
  const minorAmount = BigInt(whole) * (parsed.data.currency === "USD" ? BigInt(100) : BigInt(1))
    + BigInt(parsed.data.currency === "USD" ? fraction.padEnd(2, "0") : "0");
  if (minorAmount > BigInt(Number.MAX_SAFE_INTEGER)) return { error: "Le prix dépasse la limite autorisée." };

  let context;
  try {
    context = await getCompanyId();
  } catch {
    return { error: "Connexion Supabase indisponible. Réessayez dans un instant." };
  }
  if (!context.companyId) return { error: "Connectez-vous avant d’ajouter un article." };

  const { error } = await context.supabase.from("catalog_items").insert({
    company_id: context.companyId,
    name: parsed.data.name,
    price_amount: minorAmount.toString(),
    currency: parsed.data.currency,
    unit: parsed.data.unit,
  });
  if (error) return { error: "L’article n’a pas pu être enregistré. Vérifiez les informations puis réessayez." };

  revalidatePath("/catalogue");
  return { success: "Article ajouté au catalogue." };
}

export async function archiveCatalogItemAction(formData: FormData) {
  const id = z.uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return;
  const context = await getCompanyId();
  if (!context.companyId) return;

  await context.supabase.from("catalog_items").update({ is_active: false }).eq("id", id.data).eq("company_id", context.companyId);
  revalidatePath("/catalogue");
}

export async function enableCatalogSharingAction(): Promise<FormActionState> {
  const context = await getCompanyId();
  if (!context.companyId) return { error: "Connectez-vous avant de partager le catalogue." };
  const { error } = await context.supabase.from("catalog_shares").insert({ company_id: context.companyId });
  if (error) {
    // Un double clic ou une répétition réseau conserve le lien existant.
    const { data: existing } = await context.supabase.from("catalog_shares").select("token").eq("company_id", context.companyId).maybeSingle();
    if (!existing) return { error: "Le lien de partage n’a pas pu être créé." };
  }
  revalidatePath("/catalogue");
  return { success: "Le lien de partage est actif." };
}

export async function disableCatalogSharingAction(): Promise<FormActionState> {
  const context = await getCompanyId();
  if (!context.companyId) return { error: "Connectez-vous avant de modifier le partage." };
  const { error } = await context.supabase.from("catalog_shares").delete().eq("company_id", context.companyId);
  if (error) return { error: "Le partage n’a pas pu être désactivé." };
  revalidatePath("/catalogue");
  return { success: "Le lien public a été révoqué." };
}
