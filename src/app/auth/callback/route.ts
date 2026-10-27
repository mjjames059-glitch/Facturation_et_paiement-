import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function oauthFailure(request: NextRequest, reason: string, detail?: string) {
  const url = new URL("/auth/confirmation", request.url);
  url.searchParams.set("status", "oauth");
  url.searchParams.set("reason", reason);
  if (detail) url.searchParams.set("detail", detail);
  return NextResponse.redirect(url);
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
    const destination = profileError
      ? "/auth/confirmation?status=profile"
      : profile?.company_id
        ? "/tableau-de-bord"
        : "/auth/sign-up?mode=google";
    const response = NextResponse.redirect(new URL(destination, request.url));

    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options);
    }
    response.cookies.set("facturo_seen_login", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 5,
    });
    return response;
  } catch {
    console.error("Facturo OAuth callback failed before session completion");
    return oauthFailure(request, "server");
  }
}
