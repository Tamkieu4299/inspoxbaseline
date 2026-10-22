import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "./Icon";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";
import type { Product } from "../types";

const MIN_CHARS = 1;
const DEBOUNCE_MS = 280;
const SUGGEST_LIMIT = 8;

function productThumb(product: Product) {
  return product.images?.find((i) => i.position === 0) || product.images?.[0];
}

interface NavbarSearchProps {
  className?: string;
  autoFocus?: boolean;
  onClose?: () => void;
}

export default function NavbarSearch({ className = "", autoFocus, onClose }: NavbarSearchProps) {
  const { lang, t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const urlQ = location.pathname === "/products" ? params.get("q") || "" : "";
  const [input, setInput] = useState(urlQ);
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(input.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [input]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const canFetch = debounced.length >= MIN_CHARS;
  const { data, isFetching } = useQuery({
    queryKey: ["product-search", debounced, lang],
    queryFn: () =>
      api.getProducts({
        q: debounced,
        sort: "recommended",
        page: "1",
        page_size: String(SUGGEST_LIMIT),
        lang,
      }),
    enabled: canFetch && open,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const showPanel = open && input.trim().length > 0;
  const showEmpty = showPanel && canFetch && !isFetching && items.length === 0;
  const showResults = showPanel && canFetch && items.length > 0;

  function goToAllResults() {
    const q = input.trim();
    if (!q) return;
    setOpen(false);
    onClose?.();
    navigate(`/products?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      goToAllResults();
    }
    if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
      onClose?.();
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 min-w-0 min-h-[40px] h-10 px-2 border border-outline-variant bg-surface-container-lowest transition-colors focus-within:border-forest-green ${
          open ? "border-forest-green" : ""
        }`}
      >
        <Icon name="search" className="text-[22px] text-secondary shrink-0" />
        <input
          type="search"
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("nav.searchPlaceholder")}
          className="w-full min-w-0 bg-transparent border-none outline-none ring-0 focus:outline-none focus:ring-0 font-body text-body-sm text-primary placeholder:text-secondary/60"
        />
        {input ? (
          <button
            type="button"
            aria-label={t("nav.searchClear")}
            onClick={() => {
              setInput("");
              setOpen(false);
            }}
            className="shrink-0 p-1 text-secondary hover:text-primary"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-[60] bg-surface-container-lowest border border-outline-variant shadow-lg max-h-[min(60dvh,420px)] overflow-y-auto overscroll-contain"
          id={listId}
          role="listbox"
        >
          {!canFetch ? (
            <p className="px-4 py-3 font-body text-body-sm text-secondary">{t("nav.searchMinChars")}</p>
          ) : null}
          {canFetch && isFetching && items.length === 0 ? (
            <p className="px-4 py-3 font-body text-body-sm text-secondary">{t("loading")}</p>
          ) : null}
          {showEmpty ? (
            <p className="px-4 py-3 font-body text-body-sm text-secondary">{t("nav.searchNoResults")}</p>
          ) : null}
          {showResults
            ? items.map((product) => {
                const thumb = productThumb(product);
                return (
                  <Link
                    key={product.id}
                    to={`/products/${product.slug}`}
                    role="option"
                    onClick={() => {
                      setOpen(false);
                      onClose?.();
                    }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low transition-colors border-b border-outline-variant/50 last:border-b-0"
                  >
                    <div className="w-14 h-14 shrink-0 bg-surface-container-low overflow-hidden">
                      {thumb ? (
                        <img src={thumb.url} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-headline text-headline-sm text-primary uppercase leading-tight truncate">
                        {product.name}
                      </p>
                      <p className="font-body text-body-sm text-secondary truncate">
                        {[product.brand, product.subtitle].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="font-body text-body-sm text-primary shrink-0">{formatPrice(product.price)}</p>
                  </Link>
                );
              })
            : null}
          {showResults && total > items.length ? (
            <button
              type="button"
              onClick={goToAllResults}
              className="w-full px-4 py-3 text-left font-label text-label-caps text-forest-green hover:bg-surface-container-low transition-colors"
            >
              {t("nav.searchViewAll", { count: String(total) })}
            </button>
          ) : null}
          {showResults && total > 0 && total <= items.length ? (
            <button
              type="button"
              onClick={goToAllResults}
              className="w-full px-4 py-3 text-left font-label text-label-caps text-forest-green hover:bg-surface-container-low transition-colors border-t border-outline-variant/50"
            >
              {t("nav.searchViewAllPage")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
