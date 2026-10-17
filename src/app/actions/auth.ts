"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
    redirect("/tableau-de-bord");
  }

  return { success: "Compte créé. Consultez votre boîte e-mail pour confirmer l’adresse et vous connecter." };
}

const signInSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(72) });

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
  redirect("/tableau-de-bord");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
