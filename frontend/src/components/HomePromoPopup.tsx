import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";
import { formatMoney } from "../money";
import type { SitePublic } from "../types";
import Icon from "./Icon";

type Props = {
  site: SitePublic;
  onDismiss: () => void;
};

export default function HomePromoPopup({ site, onDismiss }: Props) {
  const { lang, t } = useLanguage();
  const products = site.home_popup_products || [];
  const promoPrice = site.home_popup_price ?? products[0]?.price;
  const listHref =
    promoPrice != null
      ? `/products?price_exact=${encodeURIComponent(String(promoPrice))}`
      : "/products";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-6 home-promo-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("home.popup.aria")}
    >
      <button
        type="button"
        className="absolute inset-0 bg-charcoal/75 backdrop-blur-sm home-promo-fade-in"
        onClick={onDismiss}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-2xl sm:max-w-3xl max-h-[min(92vh,900px)] overflow-y-auto home-promo-panel rounded-sm shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#F5F3E9] text-[#0B241E] shadow-lg hover:scale-105 transition-transform"
          aria-label={t("home.popup.close")}
        >
          <Icon name="close" className="text-[24px]" />
        </button>

        <div className="bg-[#F5F3E9] text-[#0B241E] px-5 sm:px-8 pt-8 pb-6 border-2 border-[#0B241E]">
          <header className="text-center mb-5 home-promo-stagger" style={{ animationDelay: "0.05s" }}>
            <p className="font-headline text-sm sm:text-base tracking-[0.35em] uppercase text-[#0B241E]/80">
              {site.site_name}
            </p>
            <p className="font-label text-[10px] tracking-[0.5em] uppercase text-[#0B241E]/60 mt-1">EST. 2026</p>
            <div className="mt-4 bg-[#0B241E] py-3 px-4 inline-block w-full max-w-md mx-auto">
              <h2 className="font-headline text-2xl sm:text-4xl uppercase tracking-tight">
                <span className="text-[#F5F3E9]">BLACK </span>
                <span className="text-[#D4FF3B]">FRIDAY</span>
              </h2>
            </div>
            <p className="font-label text-label-caps text-xs sm:text-sm uppercase mt-4 text-[#0B241E]/90">
              {t("home.promo.websiteOnly")}
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
            {products.map((p, i) => (
              <Link
                key={p.slug}
                to={`/products/${p.slug}`}
                onClick={onDismiss}
                className="home-promo-stagger group bg-white border border-[#0B241E]/15 p-3 flex flex-col items-center text-center hover:border-[#0B241E] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                style={{ animationDelay: `${0.12 + i * 0.08}s` }}
              >
                <div className="w-full aspect-[3/4] bg-[#F5F3E9] flex items-center justify-center overflow-hidden mb-2">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : null}
                </div>
                <p className="font-label text-[9px] sm:text-[10px] uppercase tracking-wider text-[#0B241E]/70 line-clamp-2">
                  {p.label || p.name}
                </p>
              </Link>
            ))}
          </div>

          {promoPrice != null && (
            <div className="home-promo-stagger bg-[#D4FF3B] flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 mb-4">
              <span className="font-headline text-lg sm:text-xl uppercase text-[#0B241E]">{t("home.promo.flatPrice")}</span>
              <span className="font-headline text-xl sm:text-3xl text-[#0B241E] tabular-nums">
                {formatMoney(promoPrice, site.currency_code || "VND", lang === "vi" ? "vi-VN" : "en-US")}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 home-promo-stagger" style={{ animationDelay: "0.4s" }}>
            <Link
              to={listHref}
              onClick={onDismiss}
              className="flex-1 text-center font-headline text-sm sm:text-base uppercase py-3 px-4 bg-[#0B241E] text-[#D4FF3B] hover:bg-[#163d32] transition-colors"
            >
              {t("home.promo.viewAll")}
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes home-promo-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes home-promo-panel-in {
          from { opacity: 0; transform: scale(0.88) translateY(24px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes home-promo-stagger-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .home-promo-fade-in { animation: home-promo-fade-in 0.35s ease-out both; }
        .home-promo-panel { animation: home-promo-panel-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .home-promo-stagger { animation: home-promo-stagger-in 0.5s ease-out both; }
      `}</style>
    </div>
  );
}