import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLanguage } from "../i18n";

export default function CollectionsPage() {
  const { lang, t } = useLanguage();
  const { data: collections, isLoading } = useQuery({
    queryKey: ["collections", lang],
    queryFn: () => api.getCollections(lang),
  });
  const { data: products } = useQuery({
    queryKey: ["products-all", lang],
    queryFn: () => api.getProducts({ lang }),
  });

  const totalProducts = products?.length ?? 0;

  return (
    <main className="flex-grow pt-24 px-4 md:px-8 lg:px-16 w-full max-w-[1920px] mx-auto pb-16">
      <header className="mb-10 border-b border-surface-container-high pb-4">
        <h1 className="font-headline text-headline-lg text-primary uppercase">{t("collections.title")}</h1>
        <p className="font-label text-label-caps text-secondary mt-1">
          {t("collections.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <p className="font-body text-body-md text-secondary py-16 text-center">{t("loading")}</p>
      ) : !collections || collections.length === 0 ? (
        <p className="font-body text-body-md text-secondary py-16 text-center">
          {t("collections.none")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((c) => {
            const count = c.slug === "new-arrivals" ? totalProducts : (c.products || []).length;
            return (
              <Link
                key={c.id}
                to={`/collections/${c.slug}`}
                className="group flex flex-col bg-background border border-transparent hover:border-surface-container-high p-2 transition-all"
              >
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-surface-container-low">
                  {c.hero_media ? (
                    <img
                      src={c.hero_media.url}
                      alt={c.hero_media.filename || c.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-out"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-container-low" />
                  )}
                  {c.badge && (
                    <span className="absolute top-2 left-2 bg-forest-green text-white font-label text-label-caps px-2 py-1 z-10 uppercase tracking-widest font-bold">
                      {c.badge}
                    </span>
                  )}
                </div>
                <div className="py-3 flex flex-col flex-grow">
                  <h2 className="font-headline text-headline-md text-primary uppercase leading-none group-hover:text-forest-green transition-colors">
                    {c.name}
                  </h2>
                  {c.tagline && (
                    <p className="font-label text-label-caps text-secondary mt-1">{c.tagline}</p>
                  )}
                  <p className="font-label text-label-caps text-forest-green mt-2">
                    {count} {count === 1 ? t("collections.product") : t("collections.products")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
