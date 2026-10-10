/** ISO 4217 codes supported in admin site settings. */
export const STORE_CURRENCIES = ["USD", "VND", "EUR", "GBP", "JPY", "AUD"] as const;
export type StoreCurrency = (typeof STORE_CURRENCIES)[number];

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
