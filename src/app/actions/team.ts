"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireAuthenticatedCompany } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { getLegalConsentMetadata } from "@/lib/legal";

export type TeamActionState = { error?: string; success?: string; invitationUrl?: string };

const inviteSchema = z.object({
  email: z.email().max(254),
  role: z.enum(["manager", "accountant", "collaborator", "viewer"]),
});

export async function createTeamInvitationAction(_previousState: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) return { error: "Indiquez une adresse e-mail et un rôle valides." };

  const context = await requireAuthenticatedCompany();
  if (context.role !== "owner" && context.role !== "manager") return { error: "Vous n’avez pas les droits pour inviter un membre." };
  if (context.role === "manager" && parsed.data.role === "manager") return { error: "Seul le propriétaire peut inviter un autre gestionnaire." };

  const { data, error } = await context.supabase.rpc("create_company_invitation", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  const invitation = data?.[0];
  if (error || !invitation?.invitation_token) return { error: "Impossible de créer l’invitation. Vérifiez les droits et réessayez." };

  const appUrl = getAppUrl();
  const invitationUrl = new URL("/auth/invitation", appUrl);
  invitationUrl.searchParams.set("token", invitation.invitation_token);
  revalidatePath("/equipe");
  return { success: "Invitation créée. Le lien expire dans 48 heures et ne peut être utilisé qu’une fois.", invitationUrl: invitationUrl.toString() };
}

export async function revokeTeamInvitationAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(String(formData.get("invitation_id") ?? ""));
  if (!id.success) return;
  const context = await requireAuthenticatedCompany();
  if (context.role !== "owner" && context.role !== "manager") return;
  await context.supabase.from("company_invitations").delete().eq("id", id.data).eq("company_id", context.companyId);
  revalidatePath("/equipe");
}

const invitedSignupSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  email: z.email().max(254),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(72),
  legalConsent: z.literal(true),
});

export async function acceptTeamInvitationAction(_previousState: TeamActionState, formData: FormData): Promise<TeamActionState> {
  if (formData.get("legal_consent") !== "on") {
    return { error: "Vous devez accepter la politique de confidentialité et les conditions d’utilisation." };
  }

  const parsed = invitedSignupSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    displayName: String(formData.get("display_name") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    legalConsent: formData.get("legal_consent") === "on",
  });
  if (!parsed.success) return { error: "Vérifiez le nom et le mot de passe (8 caractères minimum)." };

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { error: "La connexion à Facturo est indisponible. Réessayez dans un instant." };
  }

  const { data: invitationRows, error: invitationError } = await supabase.rpc("lookup_company_invitation", { p_token: parsed.data.token });
  const invitation = invitationRows?.[0];
  if (invitationError || !invitation || invitation.invited_email !== parsed.data.email) {
    return { error: "Cette invitation est invalide, expirée ou destinée à une autre adresse." };
  }

  const appUrl = getAppUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: new URL("/auth/callback", appUrl).toString(),
      data: { display_name: parsed.data.displayName, company_invite_token: parsed.data.token, ...getLegalConsentMetadata() },
    },
  });
  if (error || !data.user) return { error: "Impossible de créer le compte. Vérifiez l’adresse et réessayez." };
  if (data.session) {
    (await cookies()).set("facturo_seen_login", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 * 5 });
    redirect("/tableau-de-bord");
  }
  redirect("/auth/confirmation");
}
