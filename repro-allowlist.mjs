const AUTH = "https://ksntjhxnfmnlxipnldcb.supabase.co";
const KEY = "sb_publishable_1RTRp--2vCT9yovHxraBqg_KxKyhQjr";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const candidates = [
  "http://localhost:3000/auth/callback",
  "https://facturation-et-paiement-james-digital-lab.vercel.app/auth/callback",
  "https://facturation-et-paiement-james-digital-lab.vercel.app",
  "http://localhost:3001/auth/callback",
  "https://example.com/foo",
];

for (const redirectTo of candidates) {
  const u = new URL(`${AUTH}/auth/v1/authorize`);
  u.searchParams.set("provider", "google");
  u.searchParams.set("redirect_to", redirectTo);
  u.searchParams.set("code_challenge", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  u.searchParams.set("code_challenge_method", "s256");
  u.searchParams.set("skip_http_redirect", "true");

  const res = await fetch(u, { headers: H, redirect: "manual" });
  const body = await res.text();
  const m = body.match(/state=([0-9a-f-]{36})/);
  const state = m ? m[1] : null;

  let verdict = "no state found";
  if (state) {
    const cb = await fetch(`${AUTH}/auth/v1/callback?state=${state}&code=bogus_code`, {
      headers: H,
      redirect: "manual",
    });
    const loc = cb.headers.get("location") ?? "(no location)";
    verdict = loc.includes(redirectTo)
      ? `ALLOWED  -> ${loc.slice(0, 120)}`
      : `NOT ALLOWED (fell back) -> ${loc.slice(0, 160)}`;
  }
  console.log(`\n${redirectTo}\n   ${verdict}`);
}
