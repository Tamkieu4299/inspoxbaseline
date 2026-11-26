/** Store currency (prices stored and displayed in this unit). */
export const STORE_CURRENCIES = ["VND"] as const;

/** Nearest 10,000₫ for customer-facing retail (e.g. 2_859_200 → 2_860_000). */
export const RETAIL_VND_ROUND = 10_000;

export function roundRetailVnd(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount < RETAIL_VND_ROUND) return Math.round(amount);
  if (amount % RETAIL_VND_ROUND === RETAIL_VND_ROUND / 2) return Math.round(amount);
  return Math.round(amount / RETAIL_VND_ROUND) * RETAIL_VND_ROUND;
}

export type StoreCurrency = (typeof STORE_CURRENCIES)[number];

export function usesWholeCurrencyUnits(currencyCode: string): boolean {
  const code = (currencyCode || "VND").toUpperCase();
  return code === "VND" || code === "JPY";
}

/** HTML number input step for product price fields. */
export function priceInputStep(currencyCode: string): string {
  return usesWholeCurrencyUnits(currencyCode) ? "1" : "0.01";
}

export function formatMoney(amount: number, currencyCode: string, locale?: string): string {
  const code = (currencyCode || "VND").toUpperCase();
  const noCents = code === "VND" || code === "JPY";
  const loc = locale || "vi-VN";
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: code,
      minimumFractionDigits: noCents ? 0 : 2,
      maximumFractionDigits: noCents ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(noCents ? 0 : 0)} ${code}`;
  }
}
