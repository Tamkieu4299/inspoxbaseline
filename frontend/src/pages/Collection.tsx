import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../i18n";
import type { Product } from "../types";

const ALL_COLORS: { name: string; hex: string }[] = [
  { name: "BLUE", hex: "#2f5d8a" },
  { name: "GREEN", hex: "#3a6b4f" },
  { name: "PINK", hex: "#d98a96" },
];

export default function Collection() {
  const { lang, t } = useLanguage();
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();

  const activeCollection = slug || params.get("collection") || "";
  const category = params.get("category") || "";
  const size = params.get("size") || "";
  const color = params.get("color") || "";
  const sort = params.get("sort") || "newest";

  const [showFilters, setShowFilters] = useState(false);

  const { data: collections } = useQuery({
    queryKey: ["collections", lang],
    queryFn: () => api.getCollections(lang),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories", lang],
    queryFn: () => api.getCategories(lang),
  });
  const { data: products, isLoading } = useQuery({
    queryKey: ["products", activeCollection, category, size, color, sort, lang],
    queryFn: () =>
      api.getProducts({
        collection: collectionFilter,
        category: category || undefined,
        size: size || undefined,
        color: color || undefined,
        sort,
        lang,
      }),
  });

  const currentCollection = collections?.find((c) => c.slug === activeCollection);
  const currentCategory = categories?.find((c) => c.slug === category);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    (products || []).forEach((p: Product) => (p.sizes || []).forEach((s) => set.add(s)));
    return Array.from(set);
  }, [products]);

  const collectionFilter =
    activeCollection === "new-arrivals" ? undefined : activeCollection || undefined;

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const itemCount = products?.length ?? 0;

  return (
    <main className="flex-grow pt-24 px-4 md:px-8 lg:px-16 w-full max-w-[1920px] mx-auto pb-16">
      {/* Page Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-surface-container-high pb-4">
        <div>
          <h1 className="font-headline text-headline-lg text-primary uppercase">
            {category
              ? currentCategory?.name || category.replace(/-/g, " ").toUpperCase()
              : activeCollection
                ? currentCollection?.name || activeCollection.replace(/-/g, " ").toUpperCase()
                : t("collection.shopAll")}
          </h1>
          <p className="font-label text-label-caps text-secondary mt-1">
            {itemCount} {itemCount === 1 ? t("collection.itemFound") : t("collection.itemsFound")}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-2">
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
            <option value="newest">{t("collection.newest")}</option>
            <option value="name">{t("collection.name")}</option>
          </select>
        </div>
      </header>

      {/* Layout: Sidebar + Grid */}
      <div className="grid grid-cols-12 gap-6 relative">
        <aside className={`${showFilters ? "block" : "hidden"} lg:block col-span-12 lg:col-span-2`}>
          <div className="flex flex-col gap-8">
            {/* Category */}
            <div>
              <h3 className="font-headline text-headline-md text-primary mb-2 uppercase border-b border-surface-container-high pb-1">
                {t("collection.category")}
              </h3>
              <ul className="flex flex-col gap-1 font-label text-label-caps text-secondary">
                <li>
                  <label className="flex items-center gap-1 cursor-pointer hover:text-forest-green transition-colors">
                    <input
                      type="checkbox"
                      checked={!category}
                      onChange={() => update("category", "")}
                      className="form-checkbox bg-background border-surface-container-highest text-forest-green focus:ring-forest-green h-4 w-4"
                    />
                    <span className={!category ? "text-forest-green font-bold" : ""}>{t("collection.all")}</span>
                  </label>
                </li>
                {(categories || []).map((cat) => (
                  <li key={cat.id}>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-forest-green transition-colors">
                      <input
                        type="checkbox"
                        checked={category === cat.slug}
                        onChange={() => update("category", category === cat.slug ? "" : cat.slug)}
                        className="form-checkbox bg-background border-surface-container-highest text-forest-green focus:ring-forest-green h-4 w-4"
                      />
                      <span className={category === cat.slug ? "text-forest-green font-bold" : ""}>
                        {cat.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* Size */}
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

            {/* Color */}
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
          </div>
        </aside>

        {/* Product Grid */}
        <div className="col-span-12 lg:col-span-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            <p className="col-span-full font-body text-body-md text-secondary py-16 text-center">{t("loading")}</p>
          ) : !products || products.length === 0 ? (
            <p className="col-span-full font-body text-body-md text-secondary py-16 text-center">
              {t("collection.noMatch")}
            </p>
          ) : (
            products.map((product) => <ProductCard key={product.id} product={product} />)
          )}
          <div className="col-span-full flex justify-center mt-8 border-t border-surface-container-high pt-8">
            <Link
              to="/products"
              className="bg-forest-green text-white font-label text-label-caps py-4 px-10 uppercase tracking-widest hover:bg-inverse-surface transition-colors"
            >
              {t("viewAllProducts")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
