"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { requirePlatformAdmin } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordRecoveryActionState = {
  error?: string;
  success?: string;
  recoveryLink?: string;
};

const emailSchema = z.email().max(254);
const requestIdSchema = z.uuid();
const passwordSchema = z.object({
  password: z.string().min(8).max(72),
  confirmation: z.string().min(8).max(72),
}).refine((value) => value.password === value.confirmation, {
  path: ["confirmation"],
});

export async function requestPasswordRecoveryAction(
  _previousState: PasswordRecoveryActionState,
  formData: FormData,
): Promise<PasswordRecoveryActionState> {
  const parsedEmail = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsedEmail.success) return { error: "Saisissez une adresse e-mail valide." };

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Facturo password recovery configuration failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "Le service de récupération est momentanément indisponible. Réessayez plus tard." };
  }

  let redirectTo: string;
  try {
    redirectTo = new URL("/auth/recovery", getAppUrl()).toString();
  } catch (error) {
    console.error("Facturo password recovery redirect configuration failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "Le service de récupération est momentanément indisponible. Réessayez plus tard." };
  }

  const { data: quotaData, error: quotaError } = await supabase.rpc("register_password_recovery_request", {
    p_email: parsedEmail.data,
  });
  if (quotaError) {
    console.error("Facturo password recovery quota check failed", { code: quotaError.code });
    return { error: "Impossible de traiter la demande pour le moment. Réessayez plus tard." };
  }

  const quota = Array.isArray(quotaData) ? quotaData[0] as {
    request_allowed: boolean;
    admin_required: boolean;
  } | undefined : undefined;
  if (!quota) {
    console.error("Facturo password recovery quota returned no result");
    return { error: "Impossible de traiter la demande pour le moment. Réessayez plus tard." };
  }

  if (!quota.request_allowed) {
    return {
      success: "La limite de deux envois par jour est atteinte. Si cette adresse correspond à un compte Facturo, la demande a été transmise à l’administrateur. Contactez-le pour poursuivre.",
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, { redirectTo });
    if (error) {
      console.error("Facturo password recovery email failed", {
        code: error.code ?? "unknown",
        status: error.status ?? "unknown",
      });
      return { error: "L’e-mail n’a pas pu être envoyé. Réessayez plus tard ou contactez l’administrateur Facturo." };
    }
  } catch (error) {
    console.error("Facturo password recovery email request failed unexpectedly", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "L’e-mail n’a pas pu être envoyé. Réessayez plus tard ou contactez l’administrateur Facturo." };
  }

  return {
    success: "Si cette adresse est associée à un compte Facturo, un lien de récupération vient d’être envoyé. Vérifiez aussi vos courriers indésirables.",
  };
}

export async function updatePasswordAction(
  _previousState: PasswordRecoveryActionState,
  formData: FormData,
): Promise<PasswordRecoveryActionState> {
  const parsedPassword = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmation: String(formData.get("confirmation") ?? ""),
  });
  if (!parsedPassword.success) {
    return { error: "Les mots de passe doivent être identiques et contenir entre 8 et 72 caractères." };
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Facturo password update configuration failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "La session de récupération a expiré. Demandez un nouveau lien." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: "La session de récupération a expiré. Demandez un nouveau lien." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password: parsedPassword.data.password });
  if (passwordError) {
    console.error("Facturo password update failed", {
      code: passwordError.code ?? "unknown",
      status: passwordError.status ?? "unknown",
    });
    return { error: "Le mot de passe n’a pas pu être mis à jour. Vérifiez les critères puis réessayez." };
  }

  const { data: isPlatformAdmin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError) {
    console.error("Facturo post-recovery admin lookup failed", { code: adminError.code });
    return { error: "Le mot de passe a été changé. Reconnectez-vous pour accéder à votre espace." };
  }
  if (isPlatformAdmin) redirect("/admin");

  const { data: companyId, error: companyError } = await supabase.rpc("current_company_id");
  if (companyError) {
    console.error("Facturo post-recovery workspace lookup failed", { code: companyError.code });
    return { error: "Le mot de passe a été changé. Reconnectez-vous pour accéder à votre espace." };
  }
  if (companyId) redirect("/tableau-de-bord");

  return { error: "Le mot de passe a été changé, mais aucun espace Facturo n’est associé à ce compte. Contactez l’administrateur." };
}

async function releaseRecoveryRequest(supabase: Awaited<ReturnType<typeof requirePlatformAdmin>>["supabase"], requestId: string) {
  const { error } = await supabase.rpc("release_password_recovery_request", { p_request_id: requestId });
  if (error) {
    console.error("Facturo password recovery request release failed", { code: error.code });
  }
}

export async function generateAdminRecoveryLinkAction(
  _previousState: PasswordRecoveryActionState,
  formData: FormData,
): Promise<PasswordRecoveryActionState> {
  const parsedId = requestIdSchema.safeParse(String(formData.get("request_id") ?? ""));
  if (!parsedId.success) return { error: "La demande de récupération sélectionnée est invalide." };

  const context = await requirePlatformAdmin();
  let redirectTo: string;
  try {
    redirectTo = new URL("/auth/recovery", getAppUrl()).toString();
  } catch (error) {
    console.error("Facturo admin recovery redirect configuration failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "L’URL de récupération n’est pas correctement configurée." };
  }

  const { data: claimData, error: claimError } = await context.supabase.rpc("claim_password_recovery_request", {
    p_request_id: parsedId.data,
  });
  if (claimError) {
    console.error("Facturo password recovery request claim failed", { code: claimError.code });
    return { error: "Impossible de prendre en charge cette demande. Actualisez la page puis réessayez." };
  }
  const claimed = Array.isArray(claimData) ? claimData[0] as { email: string } | undefined : undefined;
  if (!claimed?.email) {
    return { error: "Cette demande est déjà traitée ou en cours de traitement. Actualisez la page." };
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    await releaseRecoveryRequest(context.supabase, parsedId.data);
    console.error("Facturo admin recovery client configuration failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "La génération du lien n’est pas configurée. Vérifiez la variable serveur SUPABASE_SERVICE_ROLE_KEY." };
  }

  let recoveryLink: string;
  try {
    const result = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: claimed.email,
      options: { redirectTo },
    });
    if (result.error || !result.data.properties.action_link) {
      await releaseRecoveryRequest(context.supabase, parsedId.data);
      console.error("Facturo admin recovery link generation failed", {
        code: result.error?.code ?? "missing_action_link",
        status: result.error?.status ?? "unknown",
      });
      return { error: "Supabase n’a pas pu générer le lien. La demande reste disponible pour un nouvel essai." };
    }
    recoveryLink = result.data.properties.action_link;
  } catch (error) {
    await releaseRecoveryRequest(context.supabase, parsedId.data);
    console.error("Facturo admin recovery link request failed unexpectedly", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { error: "Supabase n’a pas pu générer le lien. La demande reste disponible pour un nouvel essai." };
  }

  const { error: finishError } = await context.supabase.rpc("finish_password_recovery_request", {
    p_request_id: parsedId.data,
  });
  if (finishError) {
    await releaseRecoveryRequest(context.supabase, parsedId.data);
    console.error("Facturo admin recovery request finalization failed", { code: finishError.code });
    return { error: "Le lien a été créé, mais la demande n’a pas pu être finalisée. Actualisez la page avant tout nouvel essai." };
  }

  return {
    success: "Lien généré. Il est affiché une seule fois dans cette page : copiez-le et transmettez-le directement à l’utilisateur.",
    recoveryLink,
  };
}
