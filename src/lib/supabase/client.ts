"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

export function createSupabaseBrowserClient(detectSessionInUrl = true) {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient(url, publishableKey, {
    auth: { detectSessionInUrl },
  });
}
