import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  // Supabase ignores the requested redirect URL when it is not part of the
  // project allow list and lands the browser on the site URL instead. The
  // authorization code would then be dropped by the page that receives it, so
  // the callback route is always the one that handles it.
  if (request.nextUrl.pathname !== "/auth/callback") {
    const hasOAuthParams = request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("error");
    if (hasOAuthParams) {
      const callbackUrl = request.nextUrl.clone();
      callbackUrl.pathname = "/auth/callback";
      return NextResponse.redirect(callbackUrl);
    }
  }

  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
