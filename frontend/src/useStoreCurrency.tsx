import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useLanguage } from "./i18n";
import { formatMoney } from "./money";

interface StoreCurrencyContextValue {
  currencyCode: string;
  formatPrice: (amount: number) => string;
}

const StoreCurrencyContext = createContext<StoreCurrencyContextValue | null>(null);

export function StoreCurrencyProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  const { data: site } = useQuery({
    queryKey: ["site"],
    queryFn: api.getSite,
    staleTime: 60_000,
  });

  const currencyCode = (site?.currency_code || "VND").toUpperCase();
  const locale = lang === "vi" ? "vi-VN" : "vi-VN";

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
