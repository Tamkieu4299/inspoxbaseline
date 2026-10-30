import { Link } from "react-router-dom";
import { lineKey, useCart } from "../cart/CartContext";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";

export default function CartPage() {
  const { t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const { lines, subtotal, updateQuantity, removeLine } = useCart();

  if (lines.length === 0) {
    return (
      <main className="px-4 sm:px-8 lg:px-stack-xl pt-20 md:pt-24 pb-12 max-w-3xl mx-auto">
        <h1 className="font-headline text-headline-lg text-primary uppercase mb-4">{t("cart.title")}</h1>
        <p className="font-body text-body-md text-secondary mb-6">{t("cart.empty")}</p>
        <Link
          to="/products"
          className="inline-block bg-forest-green text-white font-label text-label-caps px-6 py-3 uppercase"
        >
          {t("cart.continueShopping")}
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-8 lg:px-stack-xl pt-20 md:pt-24 pb-12 max-w-4xl mx-auto">
      <h1 className="font-headline text-headline-lg text-primary uppercase mb-8">{t("cart.title")}</h1>
      <ul className="flex flex-col gap-4 mb-8">
        {lines.map((line) => {
          const key = lineKey(line);
          return (
            <li
              key={key}
              className="flex flex-col sm:flex-row gap-4 border border-outline-variant p-4 bg-white"
            >
              {line.imageUrl ? (
                <img src={line.imageUrl} alt="" className="w-24 h-24 object-cover shrink-0" />
              ) : null}
              <div className="flex-1 min-w-0">
                <Link to={`/products/${line.slug}`} className="font-headline text-headline-md text-primary hover:text-forest-green">
                  {line.name}
                </Link>
                {(line.color || line.size) && (
                  <p className="font-body text-body-sm text-secondary mt-1">
                    {[line.color, line.size].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="font-body text-body-md text-primary mt-2">{formatPrice(line.price)}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={line.quantity}
                  onChange={(e) => updateQuantity(key, Number(e.target.value) || 1)}
                  className="w-20 border border-outline-variant px-2 py-1 font-body text-body-md"
                  aria-label={t("cart.quantity")}
                />
                <button
                  type="button"
                  onClick={() => removeLine(key)}
                  className="font-body text-body-sm text-secondary hover:text-forest-green underline"
                >
                  {t("cart.remove")}
                </button>
                <p className="font-label text-label-caps text-primary">{formatPrice(line.price * line.quantity)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-outline-variant pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="font-headline text-headline-md text-primary uppercase">
          {t("cart.subtotal")}: {formatPrice(subtotal)}
        </p>
        <Link
          to="/checkout"
          className="text-center bg-forest-green text-white font-label text-label-caps px-8 py-3 uppercase hover:bg-inverse-surface transition-colors"
        >
          {t("cart.checkout")}
        </Link>
      </div>
    </main>
  );
}
