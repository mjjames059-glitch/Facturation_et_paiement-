import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function oauthFailure(request: NextRequest, reason: string, detail?: string) {
  const url = new URL("/auth/confirmation", request.url);
  url.searchParams.set("status", "oauth");
  url.searchParams.set("reason", reason);
  if (detail) url.searchParams.set("detail", detail);
  const response = NextResponse.redirect(url);
  response.cookies.set("facturo_oauth_registration", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  const providerErrorCode = request.nextUrl.searchParams.get("error_code");
  const providerErrorDescription = request.nextUrl.searchParams.get("error_description");
  if (providerError) {
    const reason = providerErrorCode === "redirect_not_allowed" ? "redirect_not_allowed" : "provider";
    return oauthFailure(request, reason, providerErrorDescription ?? providerErrorCode ?? undefined);
  }
  if (!code) return oauthFailure(request, "missing_code");

  try {
    const { url, publishableKey } = getSupabasePublicEnv();
    const cookiesToSet: Array<{ name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }> = [];
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.push(...cookies);
        },
      },
    });

    // The flow id identifies the PKCE verifier that belongs to this callback.
    const flowId = request.nextUrl.searchParams.get("sb_flow_id");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) {
      const normalizedError = `${error.code ?? ""} ${error.message}`.toLowerCase();
      const reason = normalizedError.includes("verifier") || normalizedError.includes("flow state")
        ? "pkce"
        : normalizedError.includes("expired") || normalizedError.includes("invalid grant")
          ? "expired_code"
          : "exchange";
      console.error(
        `Facturo OAuth callback exchange failed: code=${error.code ?? "unknown"} reason=${reason} message=${error.message}`,
      );
      return oauthFailure(request, reason, error.message);
    }
    if (!data.user) return oauthFailure(request, "exchange");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Facturo OAuth profile lookup failed", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
    }

    const isRegistration = request.cookies.get("facturo_oauth_registration")?.value === "1";
    if (isRegistration && !data.user.email) {
      return oauthFailure(request, "missing_email");
    }

    const isEmailConfirmation = data.user.app_metadata?.provider === "email";
    const shouldSignOut = isEmailConfirmation || (isRegistration && Boolean(profile?.company_id));
    if (shouldSignOut) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        console.error("Facturo auth callback sign-out failed", {
          code: signOutError.code ?? "unknown",
          message: signOutError.message,
        });
        return oauthFailure(request, "server", "La session n’a pas pu être fermée.");
      }
    }

    const destination = isEmailConfirmation
      ? "/auth/sign-in?notice=confirmed"
      : profileError
        ? "/auth/confirmation?status=profile"
        : isRegistration && profile?.company_id
          ? "/auth/sign-in?notice=exists"
          : isRegistration
            ? "/auth/sign-up?mode=oauth"
            : profile?.company_id
              ? "/tableau-de-bord"
              : "/auth/sign-up?mode=oauth";
    const response = NextResponse.redirect(new URL(destination, request.url));

    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options);
    }
    response.cookies.set("facturo_oauth_registration", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 0,
    });
    if (destination === "/tableau-de-bord") {
      response.cookies.set("facturo_seen_login", "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 60 * 60 * 24 * 365 * 5,
      });
    }
    return response;
  } catch (error) {
    console.error("Facturo OAuth callback failed before session completion", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "Unexpected non-Error exception",
    });
    return oauthFailure(request, "server");
  }
}
