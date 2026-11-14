import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

const providerSchema = z.enum(["google", "facebook"]);

function oauthStartFailure(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/auth/confirmation?status=oauth&reason=start", request.url));
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
  const provider = providerSchema.safeParse(request.nextUrl.searchParams.get("provider"));
  const isRegistration = request.nextUrl.searchParams.get("mode") === "register";
  if (!provider.success) return oauthStartFailure(request);

  const cookiesToSet: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];
  let authorizationUrl: string;
  try {
    const { url, publishableKey } = getSupabasePublicEnv();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies);
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider.data,
      options: {
        redirectTo: new URL("/auth/callback", getAppUrl()).toString(),
        ...(provider.data === "facebook" ? { scopes: "email,public_profile" } : {}),
      },
    });
    if (error || !data.url) {
      console.error("Facturo OAuth authorization could not be created", {
        provider: provider.data,
        code: error?.code ?? "missing_authorization_url",
        message: error?.message ?? "Supabase returned no authorization URL",
      });
      return oauthStartFailure(request);
    }
    authorizationUrl = data.url;
  } catch (error) {
    console.error("Facturo OAuth authorization could not be initialized", {
      provider: provider.data,
      message: error instanceof Error ? error.message : "Unexpected non-Error exception",
    });
    return oauthStartFailure(request);
  }

  const response = NextResponse.redirect(authorizationUrl);
  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options);
  }
  if (isRegistration) {
    response.cookies.set("facturo_oauth_registration", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 600,
    });
  } else {
    response.cookies.set("facturo_oauth_registration", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
