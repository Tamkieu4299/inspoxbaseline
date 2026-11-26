import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "../types";
import { useLanguage } from "../i18n";
import { Field, SecondaryButton, TextInput } from "./ui";

export type HomePopupItem = { slug: string; label?: string | null };

type Props = {
  items: HomePopupItem[];
  onChange: (items: HomePopupItem[]) => void;
  products: Product[];
};

export function HomePopupProductPicker({ items, onChange, products }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  const selected = useMemo(() => new Set(items.map((i) => i.slug)), [items]);

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((p) => !selected.has(p.slug))
      .filter((p) => {
        if (!term) return true;
        return (
          p.slug.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term) ||
          (p.name_vi || "").toLowerCase().includes(term)
        );
      })
      .slice(0, 30);
  }, [products, query, selected]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function addSlug(slug: string) {
    onChange([...items, { slug }]);
    setQuery("");
    setOpen(false);
  }

  function updateItem(index: number, patch: Partial<HomePopupItem>) {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  }

  const thumb = (p: Product | undefined) => {
    const url = p?.images?.find((i) => i.enabled !== false)?.url;
    if (!url) {
      return <div className="w-10 h-10 bg-surface-container-high shrink-0" />;
    }
    return <img src={url} alt="" className="w-10 h-10 object-cover shrink-0" />;
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("admin.homePopup.productsAdd")}>
        <div ref={wrapRef} className="relative">
          <TextInput
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t("admin.homePopup.productsSearchPlaceholder")}
            autoComplete="off"
          />
          {open && (
            <ul
              className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto border border-surface-container-highest bg-white shadow-lg rounded"
              role="listbox"
            >
              {suggestions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-secondary">{t("admin.homePopup.productsNoResults")}</li>
              ) : (
                suggestions.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-low transition-colors"
                      onClick={() => addSlug(p.slug)}
                    >
                      {thumb(p)}
                      <span className="min-w-0 flex-1">
                        <span className="block font-body text-sm text-on-surface truncate">{p.name}</span>
                        <span className="block font-mono text-[10px] text-secondary truncate">{p.slug}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </Field>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2 border border-surface-container-highest rounded p-2 bg-surface-container-lowest">
          {items.map((row, index) => {
            const p = bySlug.get(row.slug);
            return (
              <li
                key={`${row.slug}-${index}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-white border border-surface-container-high rounded"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {thumb(p)}
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-on-surface truncate">{p?.name || row.slug}</p>
                    <p className="font-mono text-[10px] text-secondary truncate">{row.slug}</p>
                  </div>
                </div>
                <TextInput
                  className="sm:max-w-[200px]"
                  value={row.label || ""}
                  onChange={(e) => updateItem(index, { label: e.target.value.trim() || null })}
                  placeholder={t("admin.homePopup.shortLabelPlaceholder")}
                />
                <div className="flex items-center gap-1 shrink-0">
                  <SecondaryButton type="button" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                    ↑
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>
                    ↓
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={() => removeItem(index)}>
                    {t("admin.remove")}
                  </SecondaryButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-body text-body-sm text-secondary">{t("admin.homePopup.productsEmpty")}</p>
      )}
    </div>
  );
}