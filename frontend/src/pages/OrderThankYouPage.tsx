import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../i18n";

export default function OrderThankYouPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const orderNumber = params.get("order") || "";

  return (
    <main className="px-4 sm:px-8 pt-20 md:pt-24 pb-16 max-w-lg mx-auto text-center">
      <h1 className="font-headline text-headline-lg text-primary uppercase mb-4">{t("order.thankYouTitle")}</h1>
      <p className="font-body text-body-md text-secondary mb-2">{t("order.thankYouBody")}</p>
      {orderNumber ? (
        <p className="font-headline text-headline-md text-forest-green mb-8">{orderNumber}</p>
      ) : null}
      <p className="font-body text-body-sm text-secondary mb-8">{t("order.codReminder")}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/orders/track" className="font-label text-label-caps text-forest-green underline uppercase">
          {t("order.trackLink")}
        </Link>
        <Link to="/products" className="font-label text-label-caps text-primary underline uppercase">
          {t("cart.continueShopping")}
        </Link>
      </div>
    </main>
  );
}
