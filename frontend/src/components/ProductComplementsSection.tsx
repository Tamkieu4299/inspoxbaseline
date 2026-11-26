import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";
import type { ProductComplementOut } from "../types";

export default function ProductComplementsSection({
  items,
  compact = false,
}: {
  items: ProductComplementOut[];
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const strings = items.filter((c) => c.role === "tennis_string");
  const other = items.filter((c) => c.role !== "tennis_string");
  const list = [...strings, ...other];
  if (!list.length) return null;

  return (
    <section className={compact ? "mt-4 pt-4 border-t border-outline-variant/60" : "mt-12 pt-10 border-t border-outline-variant"}>
      <h2 className={`font-headline uppercase text-primary mb-4 ${compact ? "text-headline-sm" : "text-headline-md"}`}>
        {strings.length ? t("product.suggestedStrings") : t("product.pairsWellWith")}
      </h2>
      <ul className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {list.map((row) => (
          <li key={`${row.role}-${row.product.id}`}>
            <Link
              to={`/products/${row.product.slug}`}
              className="flex items-center gap-3 border border-outline-variant p-3 bg-surface-container-lowest hover:border-forest-green transition-colors h-full"
            >
              {row.product.image_url ? (
                <img
                  src={row.product.image_url}
                  alt=""
                  className={`object-cover bg-white shrink-0 ${compact ? "w-14 h-14" : "w-16 h-16"}`}
                />
              ) : (
                <div className={`bg-surface-container shrink-0 ${compact ? "w-14 h-14" : "w-16 h-16"}`} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-label text-label-caps text-secondary text-[10px] uppercase tracking-wider">
                  {row.role === "tennis_string" ? t("product.stringLabel") : t("product.pairLabel")}
                </p>
                <p className="font-body text-body-sm text-primary line-clamp-2">{row.product.name}</p>
                <p className="font-body text-body-sm text-secondary mt-0.5">
                  {formatPrice(row.product.price, { roundRetail: !row.product.retail_price_exact })}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
