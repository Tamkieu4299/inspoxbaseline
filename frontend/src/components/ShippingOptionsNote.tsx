import { useLanguage } from "../i18n";

/** Informational copy for cart / checkout (not a selectable shipping method). */
export default function ShippingOptionsNote() {
  const { t } = useLanguage();
  return (
    <aside className="rounded border border-surface-container-high bg-surface-container-low p-4 font-body text-body-sm text-secondary space-y-2">
      <p className="font-label text-label-caps text-primary uppercase tracking-wide">{t("cart.shippingOptionsTitle")}</p>
      <ul className="space-y-1.5">
        <li className="flex gap-2">
          <span className="text-forest-green shrink-0" aria-hidden>
            •
          </span>
          <span>{t("cart.shippingStandard")}</span>
        </li>
        <li className="flex gap-2">
          <span className="text-forest-green shrink-0" aria-hidden>
            •
          </span>
          <span>{t("cart.shippingExpress")}</span>
        </li>
        <li className="flex gap-2">
          <span className="text-forest-green shrink-0" aria-hidden>
            •
          </span>
          <span>{t("cart.shippingSameDay")}</span>
        </li>
      </ul>
    </aside>
  );
}