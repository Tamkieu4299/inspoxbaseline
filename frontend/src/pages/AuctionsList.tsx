import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import RevealOnScroll from "../components/RevealOnScroll";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";

export default function AuctionsList() {
  const { lang, t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const { data: site } = useQuery({ queryKey: ["site"], queryFn: () => api.getSite(lang) });
  const { data: lots, isLoading } = useQuery({
    queryKey: ["auctions", lang],
    queryFn: () => api.getAuctions(lang),
    enabled: Boolean(site?.bidding_enabled),
  });

  if (!site?.bidding_enabled) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="font-body text-body-md text-secondary">{t("auctions.disabled")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-16">
      <header className="mb-10 md:mb-14">
        <h1 className="font-headline text-headline-lg text-primary uppercase">{t("auctions.title")}</h1>
        <p className="font-body text-body-md text-secondary mt-2 max-w-2xl">{t("auctions.subtitle")}</p>
      </header>

      {isLoading && (
        <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
      )}

      {!isLoading && (lots || []).length === 0 && (
        <p className="font-body text-body-md text-secondary">{t("auctions.empty")}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {(lots || []).map((lot, i) => (
          <RevealOnScroll key={lot.id} delay={i * 0.05}>
            <Link
              to={`/auctions/${lot.product_slug}`}
              className="group flex flex-col h-full border border-surface-container-highest bg-white hover:border-primary transition-colors"
            >
              <div className="aspect-[4/5] bg-surface-container-low overflow-hidden">
                {lot.image_url ? (
                  <img
                    src={lot.image_url}
                    alt={lot.product_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : null}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <span className="font-label text-label-caps text-forest-green uppercase">{t("auctions.live")}</span>
                <h2 className="font-headline text-headline-sm text-primary uppercase line-clamp-2">
                  {lot.headline || lot.product_name}
                </h2>
                <p className="font-body text-body-sm text-secondary">
                  {t("auctions.current")}:{" "}
                  <strong className="text-primary">
                    {lot.current_bid != null ? formatPrice(lot.current_bid) : formatPrice(lot.starting_bid)}
                  </strong>
                </p>
                <p className="font-label text-label-caps text-secondary uppercase text-xs mt-auto">
                  {t("auctions.minNext")}: {formatPrice(lot.min_next_bid)}
                </p>
              </div>
            </Link>
          </RevealOnScroll>
        ))}
      </div>
    </div>
  );
}