export function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("L’URL de l’application doit utiliser HTTP ou HTTPS.");
    return url.origin;
  }

  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelDomain) return `https://${vercelDomain.replace(/^https?:\/\//, "")}`;

  return "http://localhost:3000";
}
