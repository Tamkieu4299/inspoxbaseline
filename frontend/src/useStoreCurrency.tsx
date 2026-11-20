import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLanguage } from "./i18n";
import { formatMoney, roundRetailVnd } from "./money";

export type FormatPriceOptions = {
  /** When false, show exact amount (e.g. auction bids). Default true for product retail. */
  roundRetail?: boolean;
};

interface StoreCurrencyContextValue {
  currencyCode: string;
  formatPrice: (amount: number, options?: FormatPriceOptions) => string;
}

const StoreCurrencyContext = createContext<StoreCurrencyContextValue | null>(null);

export function StoreCurrencyProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useLanguage();
  const currencyCode = "VND";
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  const value = useMemo<StoreCurrencyContextValue>(
    () => ({
      currencyCode,
      formatPrice: (amount: number, options?: FormatPriceOptions) => {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
          return t("product.contactPrice");
        }
        const roundRetail = options?.roundRetail !== false;
        const value = roundRetail ? roundRetailVnd(n) : n;
        return formatMoney(value, currencyCode, locale);
      },
    }),
    [currencyCode, locale, t],
  );

  return <StoreCurrencyContext.Provider value={value}>{children}</StoreCurrencyContext.Provider>;
}

export function useStoreCurrency() {
  const ctx = useContext(StoreCurrencyContext);
  if (!ctx) {
    throw new Error("useStoreCurrency must be used within StoreCurrencyProvider");
  }
  return ctx;
}
