import { Link } from "react-router-dom";
import type { Product } from "../types";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";

const COLOR_KEY: Record<string, string> = {
  BLUE: "color.blue",
  GREEN: "color.green",
  PINK: "color.pink",
};

function colorLabel(product: Product, t: (k: string) => string): string {
  const colors = product.colors || [];
  const first = colors[0];
  const name = typeof first === "string" ? first : first?.name || "";
  return t(COLOR_KEY[name] || name) || name;
}

function categoryNames(product: Product): string {
  const names = (product.categories?.length ? product.categories : product.category ? [product.category] : []).map(
    (c) => c.name,
  );
  return names.join(" · ");
}

export default function ProductCard({ product }: { product: Product }) {
  const { t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const cats = categoryNames(product);
  const image = product.images?.find((i) => i.position === 0) || product.images?.[0];
  return (
    <Link
      to={`/products/${product.slug}`}
      className="group cursor-pointer flex h-full flex-col bg-background border border-transparent hover:border-surface-container-high p-2 transition-all"
    >
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-surface-container-low">
        {(product.badge || product.is_featured) && (
          <div className="absolute top-2 left-2 bg-forest-green text-white font-label text-label-caps px-2 py-1 z-10 uppercase tracking-widest font-bold">
            {product.badge || t("product.hot")}
          </div>
        )}
        {image ? (
          <img
            src={image.url}
            alt={image.alt || product.name}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-surface-container-low" />
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col py-2">
        <h2 className="font-headline text-headline-md text-primary uppercase leading-snug line-clamp-3 group-hover:text-forest-green transition-colors">
          {product.name}
        </h2>
        <p className="font-body text-body-sm text-secondary mt-1 leading-snug line-clamp-2 min-h-[2.75rem]">
          {[product.subtitle || cats, colorLabel(product, t)].filter(Boolean).join(" · ")}
        </p>
        <p className="font-body text-body-md text-primary mt-auto pt-2">
          {formatPrice(product.price, { roundRetail: !product.retail_price_exact })}
        </p>
      </div>
    </Link>
  );
}
