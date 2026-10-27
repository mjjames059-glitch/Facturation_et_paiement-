import { createBrowserClient } from "@supabase/ssr";

const url = "https://ksntjhxnfmnlxipnldcb.supabase.co";
const key = "sb_publishable_1RTRp--2vCT9yovHxraBqg_KxKyhQjr";

const jar = new Map();

const client = createBrowserClient(url, key, {
  cookies: {
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (cookiesToSet) => {
      for (const { name, value } of cookiesToSet) jar.set(name, value);
    },
  },
});

await client.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: "http://localhost:3000/auth/callback",
    skipBrowserRedirect: true,
  },
});

const cookieHeader = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
console.log("sending", jar.size, "cookies to /auth/callback\n");

const res = await fetch("http://localhost:3000/auth/callback?code=bogus_code", {
  headers: { cookie: cookieHeader },
  redirect: "manual",
});
console.log("status  :", res.status);
console.log("location:", res.headers.get("location"));
