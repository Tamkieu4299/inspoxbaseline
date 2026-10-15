import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useLanguage } from "../i18n";
import type { Product } from "../types";

type Spec = NonNullable<Product["tech_specs"]>[number];

const CLAMP_LINES = 6;

function looksTruncatedAtImport(text: string) {
  const t = text.trim();
  return t.endsWith("…") || t.endsWith("...");
}

function ProductDescriptionModal({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-description-dialog-title"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest w-full sm:max-w-lg max-h-[85vh] flex flex-col border border-outline-variant shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4">
          <div className="min-w-0">
            <p className="font-label text-label-caps text-secondary uppercase mb-1">{t("product.descriptionTitle")}</p>
            <h2
              id="product-description-dialog-title"
              className="font-headline text-headline-md text-primary uppercase leading-tight"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("lightbox.close")}
            className="shrink-0 text-secondary hover:text-primary p-1"
          >
            <Icon name="close" className="text-[28px]" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <p className="font-body text-body-md text-on-background opacity-90 leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProductDescription({
  description,
  title = "",
}: {
  description?: string | null;
  title?: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const text = description?.trim() || "";

  useEffect(() => {
    const el = textRef.current;
    if (!el || !text) {
      setClamped(false);
      return;
    }
    const check = () => {
      setClamped(el.scrollHeight > el.clientHeight + 2);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  if (!text) {
    return null;
  }

  const showViewAll = clamped || looksTruncatedAtImport(text);

  return (
    <>
      <div className="mb-6 max-w-md">
        <p
          ref={textRef}
          className="font-body text-body-md text-on-background opacity-80 leading-relaxed line-clamp-6"
        >
          {text}
        </p>
        {showViewAll ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 font-label text-label-caps text-forest-green uppercase hover:text-primary transition-colors underline underline-offset-2"
          >
            {t("product.viewAllDescription")}
          </button>
        ) : null}
      </div>
      {open ? (
        <ProductDescriptionModal title={title || t("product.descriptionTitle")} description={text} onClose={() => setOpen(false)} />
      ) : null}
    </>
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
