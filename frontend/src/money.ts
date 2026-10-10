/** Storefront + admin base/display currencies (multi-currency). */
export const STORE_CURRENCIES = ["USD", "VND"] as const;
export type StoreCurrency = (typeof STORE_CURRENCIES)[number];

const DEFAULT_USD_TO_VND = 24500;

export function convertMoney(
  amount: number,
  baseCurrency: string,
  targetCurrency: string,
  usdToVndRate: number,
): number {
  const base = (baseCurrency || "USD").toUpperCase() as StoreCurrency;
  const target = (targetCurrency || "USD").toUpperCase() as StoreCurrency;
  if (base === target) return amount;
  const rate = usdToVndRate > 0 ? usdToVndRate : DEFAULT_USD_TO_VND;
  if (base === "USD" && target === "VND") return Math.round(amount * rate);
  if (base === "VND" && target === "USD") return Math.round((amount / rate) * 100) / 100;
  return amount;
}

export function usesWholeCurrencyUnits(currencyCode: string): boolean {
  const code = (currencyCode || "USD").toUpperCase();
  return code === "VND" || code === "JPY";
}

/** HTML number input step for product price fields. */
export function priceInputStep(currencyCode: string): string {
  return usesWholeCurrencyUnits(currencyCode) ? "1" : "0.01";
}

export function formatMoney(amount: number, currencyCode: string, locale?: string): string {
  const code = (currencyCode || "USD").toUpperCase();
  const noCents = code === "VND" || code === "JPY";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: noCents ? 0 : 2,
      maximumFractionDigits: noCents ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(noCents ? 0 : 2)} ${code}`;
  }
}
