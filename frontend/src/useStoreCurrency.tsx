import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLanguage } from "./i18n";
import { formatMoney } from "./money";

interface StoreCurrencyContextValue {
  currencyCode: string;
  formatPrice: (amount: number) => string;
}

const StoreCurrencyContext = createContext<StoreCurrencyContextValue | null>(null);

export function StoreCurrencyProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useLanguage();
  const currencyCode = "VND";
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  const value = useMemo<StoreCurrencyContextValue>(
    () => ({
      currencyCode,
      formatPrice: (amount: number) => {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
          return t("product.contactPrice");
        }
        return formatMoney(n, currencyCode, locale);
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
