"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMoneyToMinorUnits, quantityForDatabase, parseQuantityToMilliUnits } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InvoiceActionState = { error?: string };

const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.string().regex(/^\d{1,11}(?:[.,]\d{1,3})?$/),
  price: z.string().trim().min(1).max(24),
  unit: z.string().trim().min(1).max(40),
  catalog_item_id: z.union([z.uuid(), z.literal("")]),
});

const createInvoiceSchema = z.object({
  client_id: z.uuid(),
  currency: z.enum(["USD", "CDF"]),
  issued_at: z.iso.date(),
  due_date: z.iso.date(),
  order_reference: z.string().trim().max(200),
  lines: z.array(invoiceLineSchema).min(1).max(100),
});

export async function createInvoiceAction(_previousState: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  let rawLines: unknown;
  const serializedLines = String(formData.get("lines") ?? "");
  if (serializedLines.length > 50_000) return { error: "La facture contient trop de lignes." };
  try {
    rawLines = JSON.parse(serializedLines);
  } catch {
    return { error: "Ajoutez au moins une ligne valide à la facture." };
  }

  const parsed = createInvoiceSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    currency: String(formData.get("currency") ?? ""),
    issued_at: String(formData.get("issued_at") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
    order_reference: String(formData.get("order_reference") ?? ""),
    lines: rawLines,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [field, lineIndex, lineField] = issue.path;
    if (field === "client_id") return { error: "Choisissez un client dans la liste avant d’enregistrer." };
    if (field === "issued_at" || field === "due_date") return { error: "Vérifiez la date de facture et la date d’échéance." };
    if (field === "currency") return { error: "Choisissez USD ou CDF comme devise." };
    if (field === "order_reference") return { error: "La référence du marché ou du bon de commande est trop longue." };
    if (field === "lines" && typeof lineIndex === "number") {
      const lineFieldLabels: Record<string, string> = {
        description: "la description",
        quantity: "la quantité (supérieure à zéro, jusqu’à 3 décimales)",
        price: "le prix",
        unit: "l’unité",
        catalog_item_id: "l’article du catalogue",
      };
      const label = typeof lineField === "string" ? lineFieldLabels[lineField] : undefined;
      return { error: label ? `Ligne ${lineIndex + 1} : vérifiez ${label}.` : `Vérifiez la ligne ${lineIndex + 1}.` };
    }
    return { error: "Ajoutez au moins une ligne valide à la facture." };
  }
  if (parsed.data.due_date < parsed.data.issued_at) return { error: "La date d’échéance doit être égale ou postérieure à la date de facture." };

  const lines = [];
  for (const line of parsed.data.lines) {
    const priceMinor = parseMoneyToMinorUnits(line.price, parsed.data.currency);
    const quantityMilli = parseQuantityToMilliUnits(line.quantity.replace(",", "."));
    if (priceMinor === null || priceMinor < BigInt(0) || quantityMilli === null || quantityMilli <= BigInt(0)) {
      return { error: "Vérifiez les prix et quantités des lignes." };
    }
    lines.push({
      description: line.description,
      quantity: quantityForDatabase(line.quantity),
      unit_price: priceMinor.toString(),
      unit: line.unit,
      catalog_item_id: line.catalog_item_id || null,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return { error: "Reconnectez-vous avant de créer une facture." };

  const { error } = await supabase.rpc("create_invoice_with_lines", {
    p_client_id: parsed.data.client_id,
    p_currency: parsed.data.currency,
    p_issued_at: parsed.data.issued_at,
    p_due_date: parsed.data.due_date,
    p_order_reference: parsed.data.order_reference || null,
    p_lines: lines,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      return { error: "La fonction de création de facture est introuvable dans Supabase. Appliquez les migrations du dossier supabase/migrations, puis réessayez." };
    }
    if (error.code === "42501") return { error: "Votre session ou votre profil d’entreprise n’est plus valide. Reconnectez-vous puis réessayez." };
    if (error.code === "23503") return { error: "Le client ou l’article choisi est introuvable ou n’appartient pas à votre entreprise. Actualisez la page et réessayez." };
    if (error.code === "22023" || error.code === "22P02") return { error: "Les données de la facture sont invalides. Vérifiez les dates, les quantités et les prix." };
    return { error: "Supabase n’a pas pu enregistrer la facture. Vérifiez la configuration et les migrations, puis réessayez." };
  }

  revalidatePath("/factures");
  redirect("/factures");
}

const invoiceIdSchema = z.uuid();

export async function markInvoiceSentAction(_previousState: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const invoiceId = invoiceIdSchema.safeParse(String(formData.get("invoice_id") ?? ""));
  if (!invoiceId.success) return { error: "Facture introuvable." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_invoice_sent", { p_invoice_id: invoiceId.data });
  if (error) return { error: "Impossible de modifier le statut de cette facture." };

  revalidatePath("/factures");
  return {};
}

const paymentSchema = z.object({
  invoice_id: z.uuid(),
  paid_at: z.iso.date(),
  mode: z.enum(["cash", "bank_transfer", "check", "mobile_money", "other"]),
});

export async function registerPaymentAction(_previousState: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const parsed = paymentSchema.safeParse({
    invoice_id: String(formData.get("invoice_id") ?? ""),
    paid_at: String(formData.get("paid_at") ?? ""),
    mode: String(formData.get("mode") ?? ""),
  });
  if (!parsed.success) return { error: "Vérifiez la date et le mode de paiement." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_invoice_payment", {
    p_invoice_id: parsed.data.invoice_id,
    p_paid_at: parsed.data.paid_at,
    p_mode: parsed.data.mode,
  });
  if (error) return { error: "Impossible d’enregistrer le paiement de cette facture." };

  revalidatePath("/factures");
  return {};
}
