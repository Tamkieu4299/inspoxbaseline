/** Store currency (prices stored and displayed in this unit). */
export const STORE_CURRENCIES = ["VND"] as const;
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
