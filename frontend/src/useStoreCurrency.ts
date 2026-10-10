import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useLanguage } from "./i18n";
import { formatMoney } from "./money";

export function useStoreCurrency() {
  const { lang } = useLanguage();
  const { data: site } = useQuery({
    queryKey: ["site"],
    queryFn: api.getSite,
    staleTime: 60_000,
  });
  const currencyCode = (site?.currency_code || "USD").toUpperCase();
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  return {
    currencyCode,
    formatPrice: (amount: number) => formatMoney(amount, currencyCode, locale),
  };
}
