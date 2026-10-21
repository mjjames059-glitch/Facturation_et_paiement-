import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/auth/confirmation?status=error", request.url));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL("/tableau-de-bord", request.url));
      response.cookies.set("facturo_seen_login", "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365 * 5,
      });
      return response;
    }
  } catch {
    // Retour au formulaire avec un message générique, sans exposer le détail fournisseur.
  }

  return NextResponse.redirect(new URL("/auth/confirmation?status=error", request.url));
}
