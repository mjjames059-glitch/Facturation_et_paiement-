import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/auth/sign-in", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/tableau-de-bord", request.url));
  } catch {
    // Retour au formulaire avec un message générique, sans exposer le détail fournisseur.
  }

  return NextResponse.redirect(new URL("/auth/sign-in", request.url));
}
