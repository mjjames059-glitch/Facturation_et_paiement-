"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

const clientTypes = ["b2b", "b2a", "b2c"] as const;

const signUpSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().max(100),
  companyName: z.string().trim().min(2).max(120),
  sector: z.string().trim().min(1).max(100),
  servedClientTypes: z.array(z.enum(clientTypes)).min(1),
  vatStatus: z.enum(["yes", "no", "unknown"]),
  joinWaitlist: z.boolean(),
});

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function signUpAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("display_name") ?? "").trim(),
    companyName: String(formData.get("company_name") ?? "").trim(),
    sector: String(formData.get("sector") ?? "").trim(),
    servedClientTypes: formData.getAll("served_client_types").map(String),
    vatStatus: String(formData.get("vat_status") ?? ""),
    joinWaitlist: formData.get("join_waitlist") === "on",
  });

  if (!parsed.success) {
    return { error: "Vérifiez les champs du formulaire. Le mot de passe doit contenir au moins 8 caractères." };
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { error: "Supabase n’est pas configuré. Complétez le fichier .env.local puis réessayez." };
  }

  const appUrl = getAppUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: new URL("/auth/callback", appUrl).toString(),
      data: {
        display_name: parsed.data.displayName,
        company_name: parsed.data.companyName,
        sector: parsed.data.sector,
        served_client_types: parsed.data.servedClientTypes,
        vat_status: parsed.data.vatStatus,
        join_waitlist: parsed.data.vatStatus === "yes" && parsed.data.joinWaitlist,
      },
    },
  });

  if (error) {
    return { error: "Impossible de créer le compte. Vérifiez l’adresse e-mail et réessayez." };
  }

  if (data.session) {
    (await cookies()).set("facturo_seen_login", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 * 5 });
    redirect("/tableau-de-bord");
  }

  redirect("/auth/confirmation");
}

const confirmationEmailSchema = z.email().max(254);

export async function resendConfirmationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = confirmationEmailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Saisissez une adresse e-mail valide." };

  try {
    const supabase = await createSupabaseServerClient();
    const appUrl = getAppUrl();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.data,
      options: { emailRedirectTo: new URL("/auth/callback", appUrl).toString() },
    });
    if (error) return { error: "Impossible d’envoyer un lien pour le moment. Réessayez dans quelques minutes." };
  } catch {
    return { error: "Impossible d’envoyer un lien pour le moment. Réessayez dans quelques minutes." };
  }

  // Keep the success response generic so this form cannot reveal whether an account exists.
  return { success: "Si cette adresse attend une confirmation, un nouveau lien vient d’être envoyé. Pensez aussi à vérifier vos courriers indésirables." };
}

const signInSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(72) });
const oauthRegistrationSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  companyName: z.string().trim().min(2).max(120),
  sector: z.string().trim().min(1).max(100),
  servedClientTypes: z.array(z.enum(clientTypes)).min(1),
  vatStatus: z.enum(["yes", "no", "unknown"]),
  joinWaitlist: z.boolean(),
});

export async function completeOAuthRegistrationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = oauthRegistrationSchema.safeParse({
    displayName: String(formData.get("display_name") ?? "").trim(),
    companyName: String(formData.get("company_name") ?? "").trim(),
    sector: String(formData.get("sector") ?? "").trim(),
    servedClientTypes: formData.getAll("served_client_types").map(String),
    vatStatus: String(formData.get("vat_status") ?? ""),
    joinWaitlist: formData.get("join_waitlist") === "on",
  });
  if (!parsed.success) return { error: "Complétez votre nom, votre entreprise et au moins un type de client." };

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { error: "La connexion à Facturo est indisponible. Réessayez dans un instant." };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/auth/sign-in");

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (profileError) return { error: "Impossible de vérifier le profil. Rechargez la page ou contactez le support." };
  if (existingProfile?.company_id) redirect("/tableau-de-bord");

  const { error } = await supabase.rpc("complete_oauth_registration", {
    p_display_name: parsed.data.displayName,
    p_company_name: parsed.data.companyName,
    p_sector: parsed.data.sector,
    p_served_client_types: parsed.data.servedClientTypes,
    p_vat_status: parsed.data.vatStatus,
    p_join_waitlist: parsed.data.joinWaitlist,
  });
  if (error) return { error: "Impossible de terminer l’inscription. Vérifiez que les migrations Facturo sont appliquées dans Supabase." };

  (await cookies()).set("facturo_seen_login", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 * 5 });
  redirect("/tableau-de-bord");
}

export async function signInAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) return { error: "Saisissez une adresse e-mail valide et votre mot de passe." };

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { error: "Supabase n’est pas configuré. Complétez le fichier .env.local puis réessayez." };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Adresse e-mail ou mot de passe incorrect." };
  (await cookies()).set("facturo_seen_login", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 * 5 });
  redirect("/tableau-de-bord");
}

async function startProviderSignIn(provider: "google" | "facebook"): Promise<AuthActionState> {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Supabase n’est pas configuré." }; }
  const appUrl = getAppUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: new URL("/auth/callback", appUrl).toString() },
  });
  if (error || !data.url) return { error: "Connexion sociale indisponible. Vérifiez sa configuration dans Supabase." };
  redirect(data.url);
}

export async function signInWithGoogleAction(_previousState: AuthActionState): Promise<AuthActionState> {
  return startProviderSignIn("google");
}

export async function signInWithFacebookAction(_previousState: AuthActionState): Promise<AuthActionState> {
  return startProviderSignIn("facebook");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
