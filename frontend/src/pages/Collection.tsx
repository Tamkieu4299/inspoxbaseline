import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import RevealOnScroll from "../components/RevealOnScroll";
import { useLanguage } from "../i18n";
import type { Product } from "../types";
import { navCategories } from "../categoryNav";

const ALL_COLORS: { name: string; hex: string }[] = [
  { name: "BLUE", hex: "#2f5d8a" },
  { name: "GREEN", hex: "#3a6b4f" },
  { name: "PINK", hex: "#d98a96" },
];

function formatBrandLabel(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Collection() {
  const { lang, t } = useLanguage();
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();

  const activeCollection = slug || params.get("collection") || "";
  const collectionFilter =
    activeCollection === "new-arrivals" ? undefined : activeCollection || undefined;
  const category = params.get("category") || "";
  const brand = params.get("brand") || "";
  const size = params.get("size") || "";
  const color = params.get("color") || "";
  const sort = params.get("sort") || "recommended";
  const q = (params.get("q") || "").trim();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = 24;

  const [showFilters, setShowFilters] = useState(false);

  const { data: collections } = useQuery({
    queryKey: ["collections", lang],
    queryFn: () => api.getCollections(lang),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories", lang],
    queryFn: () => api.getCategories(lang),
  });
  const categoryNav = useMemo(() => navCategories(categories), [categories]);
  const brandCategory = category || undefined;
  const { data: brands } = useQuery({
    queryKey: ["product-brands", brandCategory],
    queryFn: () => api.getProductBrands(brandCategory ? { category: brandCategory } : undefined),
  });
  const { data: productPage, isLoading } = useQuery({
    queryKey: ["products", activeCollection, category, brand, size, color, sort, q, page, lang],
    queryFn: () =>
      api.getProducts({
        collection: collectionFilter,
        category: category || undefined,
        brand: brand || undefined,
        size: size || undefined,
        color: color || undefined,
        sort,
        q: q || undefined,
        page: String(page),
        page_size: String(pageSize),
        lang,
      }),
  });
  const products = productPage?.items;
  const totalItems = productPage?.total ?? 0;
  const totalPages = productPage?.total_pages ?? 1;

  const currentCollection = collections?.find((c) => c.slug === activeCollection);
  const currentCategory = categoryNav.find((c) => c.slug === category);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    (products || []).forEach((p: Product) => (p.sizes || []).forEach((s) => set.add(s)));
    return Array.from(set);
  }, [products]);

  function update(key: string, value: string) {
    const patch: Record<string, string | null> = { [key]: value || null };
    if (key !== "page") patch.page = null;
    patchParams(patch);
  }

  function setPage(next: number) {
    patchParams({ page: next <= 1 ? null : String(next) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Apply several query keys in one update (avoids stale params when clearing brand + changing category). */
  function patchParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  const itemCount = totalItems;

  return (
    <main className="flex-grow pt-20 md:pt-24 px-4 md:px-8 lg:px-16 w-full max-w-[1920px] mx-auto pb-16">
      <RevealOnScroll className="mb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-surface-container-high pb-4">
        <div>
          <h1 className="font-headline text-headline-lg text-primary uppercase">
            {q
              ? t("collection.searchResults", { q })
              : category
                ? currentCategory?.name || category.replace(/-/g, " ").toUpperCase()
                : activeCollection
                  ? currentCollection?.name || activeCollection.replace(/-/g, " ").toUpperCase()
                  : t("collection.shopAll")}
          </h1>
          <p className="font-label text-label-caps text-secondary mt-1">
            {itemCount} {itemCount === 1 ? t("collection.itemFound") : t("collection.itemsFound")}
            {brand ? ` · ${formatBrandLabel(brand)}` : ""}
            {q ? (
              <>
                {" · "}
                <Link to="/products" className="hover:text-forest-green underline underline-offset-2">
                  {t("collection.clearSearch")}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="mt-0 flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="lg:hidden font-label text-label-caps text-primary border border-surface-container-highest px-3 py-1.5 uppercase"
          >
            {showFilters ? t("collection.hideFilters") : t("collection.filters")}
          </button>
          <span className="font-label text-label-caps text-secondary hidden md:inline">{t("collection.sortBy")}</span>
          <select
            value={sort}
            onChange={(e) => update("sort", e.target.value)}
            className="bg-background text-primary border border-surface-container-highest font-label text-label-caps py-1.5 px-2 focus:border-primary focus:ring-0 outline-none cursor-pointer"
          >
            <option value="recommended">{t("collection.recommended")}</option>
            <option value="newest">{t("collection.newest")}</option>
            <option value="name">{t("collection.name")}</option>
          </select>
        </div>
      </header>
      </RevealOnScroll>

      <div className="grid grid-cols-12 gap-6 relative">
        <aside className={`${showFilters ? "block" : "hidden"} lg:block col-span-12 lg:col-span-2`}>
          <RevealOnScroll className="flex flex-col gap-8">
            <div>
              <h3 className="font-headline text-headline-md text-primary mb-2 uppercase border-b border-surface-container-high pb-1">
                {t("collection.category")}
              </h3>
              <ul className="flex flex-col gap-1 font-label text-label-caps text-secondary">
                <li>
                  <label className="flex items-center gap-1 cursor-pointer hover:text-forest-green transition-colors">
                    <input
                      type="radio"
                      name="shop-category"
                      checked={!category}
                      onChange={() => patchParams({ category: null, brand: null })}
                      className="form-radio bg-background border-surface-container-highest text-forest-green focus:ring-forest-green h-4 w-4"
                    />
                    <span className={!category ? "text-forest-green font-bold" : ""}>{t("collection.all")}</span>
                  </label>
                </li>
                {categoryNav.map((cat) => (
                  <li key={cat.id}>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-forest-green transition-colors">
                      <input
                        type="radio"
                        name="shop-category"
                        checked={category === cat.slug}
                        onChange={() => {
                          if (category === cat.slug) {
                            patchParams({ category: null, brand: null });
                          } else {
                            patchParams({ category: cat.slug, brand: null });
                          }
                        }}
                        className="form-radio bg-background border-surface-container-highest text-forest-green focus:ring-forest-green h-4 w-4"
                      />
                      <span className={category === cat.slug ? "text-forest-green font-bold" : ""}>
                        {cat.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {(brands || []).length > 0 ? (
              <div>
                <h3 className="font-headline text-headline-md text-primary mb-2 uppercase border-b border-surface-container-high pb-1">
                  {t("collection.brand")}
                </h3>
                <ul className="flex flex-col gap-1 font-label text-label-caps text-secondary">
                  <li>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-forest-green transition-colors">
                      <input
                        type="radio"
                        name="shop-brand"
                        checked={!brand}
                        onChange={() => patchParams({ brand: null })}
                        className="form-radio bg-background border-surface-container-highest text-forest-green focus:ring-forest-green h-4 w-4"
                      />
                      <span className={!brand ? "text-forest-green font-bold" : ""}>{t("collection.all")}</span>
                    </label>
                  </li>
                  {(brands || []).map((b) => (
                    <li key={b}>
                      <label className="flex items-center gap-1 cursor-pointer hover:text-forest-green transition-colors">
                        <input
                          type="radio"
                          name="shop-brand"
                          checked={brand === b}
                          onChange={() => patchParams({ brand: b })}
                          className="form-radio bg-background border-surface-container-highest text-forest-green focus:ring-forest-green h-4 w-4"
                        />
                        <span className={brand === b ? "text-forest-green font-bold" : ""}>{formatBrandLabel(b)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="font-headline text-headline-md text-primary mb-2 uppercase border-b border-surface-container-high pb-1">
                {t("collection.size")}
              </h3>
              <div className="grid grid-cols-3 gap-2 font-label text-label-caps">
                {allSizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => update("size", size === s ? "" : s)}
                    className={`py-1 border transition-colors ${
                      size === s
                        ? "border-forest-green text-white bg-forest-green"
                        : "border-surface-container-highest text-secondary hover:border-forest-green hover:text-forest-green"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-headline text-headline-md text-primary mb-2 uppercase border-b border-surface-container-high pb-1">
                {t("collection.color")}
              </h3>
              <div className="flex flex-wrap gap-1">
                {ALL_COLORS.map((c) => (
                  <button
                    key={c.name}
                    aria-label={c.name}
                    title={c.name}
                    onClick={() => update("color", color === c.name ? "" : c.name)}
                    className={`w-8 h-8 transition-colors ${
                      color === c.name
                        ? "ring-2 ring-forest-green ring-offset-2 ring-offset-background"
                        : "hover:border-forest-green"
                    }`}
                    style={{ backgroundColor: c.hex, border: "1px solid #e2e2e2" }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setParams(new URLSearchParams({ sort: params.get("sort") || "newest" }))}
              className="w-full bg-forest-green border border-forest-green text-white font-label text-label-caps py-2 uppercase hover:bg-inverse-surface hover:border-inverse-surface transition-colors"
            >
              {t("collection.clearFilters")}
            </button>
          </RevealOnScroll>
        </aside>

        <div className="col-span-12 lg:col-span-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            <p className="col-span-full font-body text-body-md text-secondary py-16 text-center">{t("loading")}</p>
          ) : !products || products.length === 0 ? (
            <p className="col-span-full font-body text-body-md text-secondary py-16 text-center">
              {t("collection.noMatch")}
            </p>
          ) : (
            products.map((product, index) => (
              <RevealOnScroll key={product.id} className="h-full" delay={(index % 8) * 45}>
                <ProductCard product={product} />
              </RevealOnScroll>
            ))
          )}
          {totalPages > 1 ? (
            <RevealOnScroll className="col-span-full flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 border-t border-surface-container-high pt-8">
              <p className="font-label text-label-caps text-secondary order-2 sm:order-1">
                {t("collection.pageOf")
                  .replace("{page}", String(page))
                  .replace("{total}", String(totalPages))}
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 border border-surface-container-highest font-label text-label-caps uppercase disabled:opacity-40 hover:border-forest-green hover:text-forest-green transition-colors"
                >
                  {t("collection.prevPage")}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 border border-primary bg-primary text-on-primary font-label text-label-caps uppercase disabled:opacity-40 hover:bg-inverse-surface transition-colors"
                >
                  {t("collection.nextPage")}
                </button>
              </div>
            </RevealOnScroll>
          ) : null}
        </div>
      </div>
    </main>
  );
}
