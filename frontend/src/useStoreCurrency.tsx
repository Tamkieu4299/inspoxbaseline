import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useLanguage } from "./i18n";
import { convertMoney, formatMoney, type StoreCurrency } from "./money";

const STORAGE_KEY = "inspo_display_currency";
const DUAL: StoreCurrency[] = ["USD", "VND"];

type DisplayCurrency = StoreCurrency;

interface StoreCurrencyContextValue {
  baseCurrency: StoreCurrency;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
  usdToVndRate: number;
  supportedCurrencies: StoreCurrency[];
  formatPrice: (amountInBase: number) => string;
  convertFromBase: (amountInBase: number, target?: DisplayCurrency) => number;
}

const StoreCurrencyContext = createContext<StoreCurrencyContextValue | null>(null);

export function StoreCurrencyProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  const { data: site } = useQuery({
    queryKey: ["site"],
    queryFn: api.getSite,
    staleTime: 60_000,
  });

  const baseCurrency = ((site?.currency_code || "USD").toUpperCase() as StoreCurrency) || "USD";
  const usdToVndRate = site?.usd_to_vnd_rate && site.usd_to_vnd_rate > 0 ? site.usd_to_vnd_rate : 24500;
  const supportedCurrencies = DUAL;
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "USD" || stored === "VND") return stored;
    return lang === "vi" ? "VND" : "USD";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, displayCurrency);
  }, [displayCurrency]);

  const setDisplayCurrency = (c: DisplayCurrency) => setDisplayCurrencyState(c);

  const value = useMemo<StoreCurrencyContextValue>(
    () => ({
      baseCurrency,
      displayCurrency,
      setDisplayCurrency,
      usdToVndRate,
      supportedCurrencies,
      convertFromBase: (amount, target = displayCurrency) =>
        convertMoney(amount, baseCurrency, target, usdToVndRate),
      formatPrice: (amountInBase) =>
        formatMoney(
          convertMoney(amountInBase, baseCurrency, displayCurrency, usdToVndRate),
          displayCurrency,
          locale,
        ),
    }),
    [baseCurrency, displayCurrency, usdToVndRate, locale],
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
