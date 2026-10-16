import Icon from "./Icon";
import { useLanguage } from "../i18n";
import { sanitizeMaterialIcon } from "../materialIcon";
import type { Product } from "../types";

type Feature = NonNullable<Product["features"]>[number];

export default function ProductFeatureGrid({ features }: { features?: Feature[] | null }) {
  const { lang, t } = useLanguage();
  const rows = features || [];
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="py-16 my-16 border-t border-outline-variant">
      <h2 className="font-headline text-headline-lg-mobile md:text-headline-lg text-primary uppercase text-center mb-16 tracking-tighter">
        {t("product.featureHighlights")}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((feature, index) => {
          const title =
            lang === "vi" ? feature.title_vi || feature.title : feature.title || feature.title_vi;
          const description =
            lang === "vi"
              ? feature.description_vi || feature.description
              : feature.description || feature.description_vi;
          const iconName = sanitizeMaterialIcon(feature.icon);
          return (
            <div
              key={index}
              className="bg-surface p-8 flex flex-col border border-transparent hover:border-outline-variant transition-colors duration-300"
            >
              {iconName ? (
                <Icon name={iconName} className="text-[48px] text-primary mb-4" />
              ) : null}
              <h4 className="font-headline text-headline-md text-primary uppercase mb-2">{title}</h4>
              <p className="font-body text-body-md text-secondary">{description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
