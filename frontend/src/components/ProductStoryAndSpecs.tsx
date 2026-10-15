import { useLanguage } from "../i18n";
import type { Product } from "../types";

type Spec = NonNullable<Product["tech_specs"]>[number];

export function ProductDescription({ description }: { description?: string | null }) {
  if (!description?.trim()) {
    return null;
  }
  return (
    <p className="font-body text-body-md text-on-background opacity-80 mb-6 max-w-md line-clamp-6">
      {description}
    </p>
  );
}

export function ProductTechSpecList({ techSpecs }: { techSpecs?: Spec[] | null }) {
  const { lang, t } = useLanguage();
  const specs = techSpecs || [];
  if (specs.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-outline-variant pt-4 mt-1">
      <h3 className="font-label text-label-caps text-primary uppercase mb-2">{t("product.techSpecs")}</h3>
      <ul className="flex flex-col gap-2">
        {specs.map((spec, index) => {
          const specLabel =
            lang === "vi" ? spec.label_vi || spec.label : spec.label || spec.label_vi;
          const specValue =
            lang === "vi" ? spec.value_vi || spec.value : spec.value || spec.value_vi;
          return (
            <li key={index} className="flex justify-between border-b border-surface-container-high pb-2 gap-4">
              <span className="font-body text-body-md text-secondary">{specLabel}</span>
              <span className="font-label text-label-caps text-primary text-right">{specValue}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
