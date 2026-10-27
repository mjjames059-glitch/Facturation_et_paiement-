import { createBrowserClient } from "@supabase/ssr";

const url = "https://ksntjhxnfmnlxipnldcb.supabase.co";
const key = "sb_publishable_1RTRp--2vCT9yovHxraBqg_KxKyhQjr";
const APP = "https://facturation-et-paiement-james-digital-lab.vercel.app";

const jar = new Map();
const client = createBrowserClient(url, key, {
  cookies: {
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (cs) => { for (const { name, value } of cs) jar.set(name, value); },
  },
});

const { data } = await client.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${APP}/auth/callback`, skipBrowserRedirect: true },
});
console.log("authorize url:", data.url.slice(0, 200), "\n");

const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
const res = await fetch(`${APP}/auth/callback?code=bogus_code`, {
  headers: { cookie: cookieHeader },
  redirect: "manual",
});
console.log("Vercel /auth/callback  status :", res.status);
console.log("Vercel /auth/callback  location:", res.headers.get("location"));

const root = await fetch(APP, { redirect: "manual" });
console.log("\nVercel /  status:", root.status, "location:", root.headers.get("location"));
