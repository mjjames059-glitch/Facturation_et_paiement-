export type CurrencyCode = "USD" | "CDF";

export function parseMoneyToMinorUnits(raw: string, currency: CurrencyCode): bigint | null {
  const value = raw.trim().replace(",", ".");
  const pattern = currency === "USD" ? /^\d{1,14}(?:\.\d{1,2})?$/ : /^\d{1,15}$/;
  if (!pattern.test(value)) return null;

  const [whole, fraction = ""] = value.split(".");
  const multiplier = currency === "USD" ? BigInt(100) : BigInt(1);
  const decimals = currency === "USD" ? BigInt(fraction.padEnd(2, "0") || "0") : BigInt(0);
  const amount = BigInt(whole) * multiplier + decimals;
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? amount : null;
}

export function parseQuantityToMilliUnits(raw: string): bigint | null {
  const value = raw.trim().replace(",", ".");
  if (!/^\d{1,11}(?:\.\d{1,3})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0") || "0");
}

export function quantityForDatabase(raw: string): string {
  const milliUnits = parseQuantityToMilliUnits(raw);
  if (milliUnits === null) return "0";
  const whole = milliUnits / BigInt(1000);
  const fraction = (milliUnits % BigInt(1000)).toString().padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function lineTotalMinor(priceMinor: bigint, quantity: string): bigint {
  const milliUnits = parseQuantityToMilliUnits(quantity) ?? BigInt(0);
  return (priceMinor * milliUnits + BigInt(500)) / BigInt(1000);
}

export function formatMinorAmount(amount: string | number | bigint, currency: CurrencyCode): string {
  const value = BigInt(amount);
  if (currency === "CDF") return `${value.toLocaleString("fr-FR")} FC`;
  const whole = value / BigInt(100);
  const fraction = (value % BigInt(100)).toString().padStart(2, "0");
  return `$${whole.toLocaleString("fr-FR")},${fraction}`;
}

export function humanPriceFromMinor(amount: string | number | bigint, currency: CurrencyCode): string {
  const value = BigInt(amount);
  if (currency === "CDF") return value.toString();
  const whole = value / BigInt(100);
  const fraction = (value % BigInt(100)).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function parseExchangeRateUnits(raw: string | number): bigint | null {
  const value = String(raw).trim().replace(",", ".");
  if (!/^\d{1,10}(?:\.\d{1,4})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * BigInt(10_000) + BigInt(fraction.padEnd(4, "0") || "0");
  return units > BigInt(0) ? units : null;
}

export function toUsdCents(amountMinor: string | number | bigint, currency: CurrencyCode, exchangeRateUnits: bigint): bigint {
  const amount = BigInt(amountMinor);
  if (currency === "USD") return amount;
  const numerator = amount * BigInt(100) * BigInt(10_000);
  return (numerator + exchangeRateUnits / BigInt(2)) / exchangeRateUnits;
}
