import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/auth/confirmation?status=oauth", request.url));
  }

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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return NextResponse.redirect(new URL("/auth/confirmation?status=oauth", request.url));
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const destination = profileError || !profile?.company_id
      ? "/auth/confirmation?status=profile"
      : "/tableau-de-bord";
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
    return NextResponse.redirect(new URL("/auth/confirmation?status=oauth", request.url));
  }
}
