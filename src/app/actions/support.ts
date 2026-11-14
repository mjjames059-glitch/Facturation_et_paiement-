"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONTACT_EMAIL } from "@/lib/contact";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";

export type SupportActionState = { error?: string; success?: string };

const supportMessageSchema = z.object({
  category: z.enum(["question", "suggestion", "issue"]),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
});

export async function submitSupportMessageAction(
  _previousState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const parsed = supportMessageSchema.safeParse({
    category: String(formData.get("category") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Choisissez un sujet et saisissez un message d’au moins 10 caractères." };
  }

  const context = await requireAuthenticatedCompany();
  const profileName = context.profile.display_name?.trim() ?? "";
  const senderName = profileName.length >= 2 ? profileName : "Utilisateur Facturo";
  const senderEmail = context.user.email?.trim().toLowerCase();
  if (!senderEmail) return { error: "Aucune adresse e-mail n’est associée à votre compte." };

  const { error } = await context.supabase.from("support_messages").insert({
    company_id: context.companyId,
    user_id: context.user.id,
    sender_name: senderName,
    sender_email: senderEmail,
    ...parsed.data,
  });
  if (error) {
    console.error("Facturo support message submission failed", {
      code: error.code,
      message: error.message,
    });
    return { error: "Votre message n’a pas pu être envoyé. Réessayez ou contactez-nous par e-mail." };
  }

  return { success: "Votre message a été enregistré dans la boîte de réception de l’administrateur. Merci pour votre retour." };
}

const messageStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["new", "read", "resolved"]),
});

export async function updateSupportMessageStatusAction(
  _previousState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const parsed = messageStatusSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!parsed.success) return { error: "État de message invalide. Actualisez la page puis réessayez." };

  const context = await requireAuthenticatedCompany();
  if (context.user.email?.toLowerCase() !== CONTACT_EMAIL.toLowerCase()) {
    return { error: "Vous n’êtes pas autorisé à gérer ces messages." };
  }

  const { data: updatedMessage, error } = await context.supabase
    .from("support_messages")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error || !updatedMessage) {
    console.error("Facturo support message status update failed", {
      code: error?.code ?? "not_found",
      message: error?.message ?? "No support message was updated",
    });
    return { error: "Impossible de mettre à jour ce message. Réessayez." };
  }

  revalidatePath("/admin/messages");
  return { success: "État du message mis à jour." };
}
