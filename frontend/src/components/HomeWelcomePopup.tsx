import { useEffect, useState } from "react";
import { tenantSlug } from "../api";
import { useLanguage } from "../i18n";
import type { SitePublic } from "../types";
import Icon from "./Icon";

function sessionKey(site: SitePublic): string {
  return `inspo-home-popup:${tenantSlug()}:${site.home_popup_image_url}`;
}

type Props = {
  site: SitePublic | undefined;
};

/** Promotional image modal — once per browser session on the homepage only. */
export default function HomeWelcomePopup({ site }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!site?.home_popup_enabled || !site.home_popup_image_url) return;
    if (sessionStorage.getItem(sessionKey(site))) return;
    setOpen(true);
  }, [site]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function dismiss() {
    if (site?.home_popup_image_url) {
      sessionStorage.setItem(sessionKey(site), "1");
    }
    setOpen(false);
  }

  if (!open || !site?.home_popup_image_url) return null;

  const artwork = (
    <img
      src={site.home_popup_image_url}
      alt=""
      className="w-full h-auto block rounded-md shadow-2xl ring-1 ring-white/10"
    />
  );

  const link = (site.home_popup_link || "").trim();

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={t("home.popup.aria")}
    >
      <button type="button" className="absolute inset-0 bg-charcoal/70 backdrop-blur-[2px]" onClick={dismiss} aria-hidden />
      <div className="relative z-10 w-full max-w-[min(420px,100%)]">
        <button
          type="button"
          onClick={dismiss}
          className="absolute -top-2 -right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-lg hover:bg-surface-container-high transition-colors"
          aria-label={t("home.popup.close")}
        >
          <Icon name="close" className="text-[22px]" />
        </button>
        {link ? (
          <a href={link} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={dismiss}>
            {artwork}
          </a>
        ) : (
          artwork
        )}
      </div>
    </div>
  );
}