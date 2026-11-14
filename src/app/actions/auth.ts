"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { getLegalConsentMetadata } from "@/lib/legal";

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
  legalConsent: z.literal(true),
});

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function signUpAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (formData.get("legal_consent") !== "on") {
    return { error: "Vous devez accepter la politique de confidentialité et les conditions d’utilisation." };
  }

  const parsed = signUpSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("display_name") ?? "").trim(),
    companyName: String(formData.get("company_name") ?? "").trim(),
    sector: String(formData.get("sector") ?? "").trim(),
    servedClientTypes: formData.getAll("served_client_types").map(String),
    vatStatus: String(formData.get("vat_status") ?? ""),
    joinWaitlist: formData.get("join_waitlist") === "on",
    legalConsent: formData.get("legal_consent") === "on",
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
        ...getLegalConsentMetadata(),
      },
    },
  });

  if (error) {
    console.error("Facturo signup failed", {
      code: error.code ?? "unknown",
      status: error.status,
    });
    return { error: "Impossible de créer le compte. Vérifiez l’adresse e-mail et réessayez." };
  }

  if (!data.user) {
    console.error("Facturo signup returned no user", { hasSession: Boolean(data.session) });
    return { error: "Supabase n’a pas confirmé la création du compte. Réessayez ou contactez l’administrateur." };
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
    if (error) {
      console.error("Facturo confirmation resend failed", {
        code: error.code ?? "unknown",
        status: error.status,
      });
      return { error: "Impossible d’envoyer un lien pour le moment. Réessayez dans quelques minutes." };
    }
  } catch (error) {
    console.error("Facturo confirmation resend failed unexpectedly", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "Impossible d’envoyer un lien pour le moment. Réessayez dans quelques minutes." };
  }

  // Keep the success response generic so this form cannot reveal whether an account exists.
  return { success: "Si cette adresse attend une confirmation, un nouveau lien vient d’être envoyé. Pensez aussi à vérifier vos courriers indésirables." };
}

const signInSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(72) });
const oauthRegistrationSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(72),
  companyName: z.string().trim().min(2).max(120),
  sector: z.string().trim().min(1).max(100),
  servedClientTypes: z.array(z.enum(clientTypes)).min(1),
  vatStatus: z.enum(["yes", "no", "unknown"]),
  joinWaitlist: z.boolean(),
  legalConsent: z.literal(true),
});

export async function completeOAuthRegistrationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (formData.get("legal_consent") !== "on") {
    return { error: "Vous devez accepter la politique de confidentialité et les conditions d’utilisation." };
  }

  const parsed = oauthRegistrationSchema.safeParse({
    displayName: String(formData.get("display_name") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    companyName: String(formData.get("company_name") ?? "").trim(),
    sector: String(formData.get("sector") ?? "").trim(),
    servedClientTypes: formData.getAll("served_client_types").map(String),
    vatStatus: String(formData.get("vat_status") ?? ""),
    joinWaitlist: formData.get("join_waitlist") === "on",
    legalConsent: formData.get("legal_consent") === "on",
  });
  if (!parsed.success) return { error: "Vérifiez les champs : le nom et l’entreprise doivent contenir au moins 2 caractères, et le mot de passe au moins 8 caractères." };

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

  const { error: consentError } = await supabase.auth.updateUser({ data: getLegalConsentMetadata() });
  if (consentError) return { error: "Impossible d’enregistrer votre acceptation. Réessayez dans un instant." };

  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (passwordError) return { error: "Impossible d’enregistrer votre mot de passe. Vérifiez qu’il contient au moins 8 caractères et réessayez." };

  const { error } = await supabase.rpc("complete_oauth_registration", {
    p_display_name: parsed.data.displayName,
    p_company_name: parsed.data.companyName,
    p_sector: parsed.data.sector,
    p_served_client_types: parsed.data.servedClientTypes,
    p_vat_status: parsed.data.vatStatus,
    p_join_waitlist: parsed.data.joinWaitlist,
  });
  if (error) return { error: "Impossible de terminer l’inscription. Vérifiez que les migrations Facturo sont appliquées dans Supabase." };

  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  if (signOutError) {
    console.error("Facturo social registration sign-out failed", {
      code: signOutError.code ?? "unknown",
      message: signOutError.message,
    });
    return { error: "Votre espace a été créé, mais la déconnexion n’a pas abouti. Déconnectez-vous puis connectez-vous avec votre adresse e-mail et votre mot de passe." };
  }

  redirect("/auth/sign-in?notice=registered");
}

export async function startOAuthRegistrationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (formData.get("legal_consent") !== "on") {
    return { error: "Acceptez la politique de confidentialité et les conditions d’utilisation pour continuer." };
  }

  const provider = z.enum(["google", "facebook"]).safeParse(String(formData.get("provider") ?? ""));
  if (!provider.success) return { error: "Choisissez Google ou Facebook pour continuer." };

  redirect(`/auth/oauth?provider=${provider.data}&mode=register`);
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

  let signInError;
  try {
    const result = await supabase.auth.signInWithPassword(parsed.data);
    signInError = result.error;
  } catch (error) {
    console.error("Facturo password sign-in request failed unexpectedly", error);
    return { error: "Le service de connexion est momentanément indisponible. Vérifiez votre connexion puis réessayez." };
  }

  if (signInError) {
    const status = signInError.status ?? 0;
    const isRateLimited = status === 429 || signInError.code === "over_request_rate_limit";
    const isServiceUnavailable =
      signInError.name === "AuthRetryableFetchError" ||
      status === 0 ||
      status >= 500 ||
      signInError.code === "request_timeout";

    if (isRateLimited || isServiceUnavailable) {
      console.error("Facturo password sign-in service failed", {
        name: signInError.name,
        code: signInError.code ?? "unknown",
        status: signInError.status ?? "unknown",
      });
      return {
        error: isRateLimited
          ? "Trop de tentatives de connexion. Réessayez dans quelques minutes."
          : "Le service de connexion est momentanément indisponible. Vérifiez votre connexion puis réessayez.",
      };
    }

    return { error: "Adresse e-mail ou mot de passe incorrect." };
  }

  (await cookies()).set("facturo_seen_login", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 * 5 });
  redirect("/tableau-de-bord");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
