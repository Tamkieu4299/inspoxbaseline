import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatMoney } from "./money";

interface StoreCurrencyContextValue {
  currencyCode: string;
  formatPrice: (amount: number) => string;
}

const StoreCurrencyContext = createContext<StoreCurrencyContextValue | null>(null);

export function StoreCurrencyProvider({ children }: { children: ReactNode }) {
  const currencyCode = "VND";
  const locale = "vi-VN";

  const value = useMemo<StoreCurrencyContextValue>(
    () => ({
      currencyCode,
      formatPrice: (amount: number) => formatMoney(amount, currencyCode, locale),
    }),
    [currencyCode, locale],
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
