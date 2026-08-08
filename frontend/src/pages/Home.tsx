import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../i18n";
import type { Collection } from "../types";

export default function Home() {
  const { lang, t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["home", lang],
    queryFn: () => api.getHome(lang),
  });

  const heroImages: string[] =
    data && data.hero.carousel && data.hero.images
      ? data.hero.images.filter((u): u is string => Boolean(u))
      : [];
  const [slide, setSlide] = useState(0);
  const intervalMs = Math.max(1000, (data?.hero.interval ?? 5) * 1000);

  useEffect(() => {
    if (heroImages.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % heroImages.length), intervalMs);
    return () => clearInterval(id);
  }, [heroImages.length, intervalMs]);

  if (isLoading || !data) {
    return (
      <main className="pt-20 max-w-[1440px] mx-auto px-8 py-16">
        <p className="font-body text-body-md text-secondary">{t("loading")}</p>
      </main>
    );
  }

  const { hero, trending, latest_drops: latestDrops, master } = data;
  const activeSlide = heroImages.length > 0 ? slide % heroImages.length : 0;
  const c = hero.colors || {};
  const titleColor = c.title || hero.text_color || undefined;
  const subtitleColor = c.subtitle || hero.text_color || undefined;

  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="relative w-full h-[870px] min-h-[600px] flex items-end pb-16 px-8 max-w-[1440px] mx-auto overflow-hidden">
        <div className="absolute inset-0 z-0 bg-surface-container-low">
          {heroImages.length > 0 ? (
            heroImages.map((url, i) => (
              <div
                key={url}
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
                style={{
                  backgroundImage: `url('${url}')`,
                  opacity: i === activeSlide ? 1 : 0,
                }}
              />
            ))
          ) : (
            hero.image && (
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url('${hero.image}')` }}
              />
            )
          )}
          {hero.gradient !== false && (
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/70 to-transparent" />
          )}
          {heroImages.length > 1 && (
            <>
              <button
                onClick={() => setSlide((s) => (s - 1 + heroImages.length) % heroImages.length)}
                aria-label="Previous slide"
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white/30 hover:bg-white/60 text-primary backdrop-blur-sm transition-colors"
              >
                <Icon name="arrow_back_ios" />
              </button>
              <button
                onClick={() => setSlide((s) => (s + 1) % heroImages.length)}
                aria-label="Next slide"
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white/30 hover:bg-white/60 text-primary backdrop-blur-sm transition-colors"
              >
                <Icon name="arrow_forward_ios" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {heroImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      i === activeSlide ? "bg-forest-green" : "bg-white/60 hover:bg-white"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="relative z-10 w-full max-w-3xl flex flex-col items-start gap-4">
          <div
            className="bg-forest-green px-3 py-1 inline-block"
            style={c.kickerBg ? { backgroundColor: c.kickerBg } : undefined}
          >
            <span
              className="font-label text-label-caps text-white uppercase tracking-widest font-bold"
              style={c.kickerText ? { color: c.kickerText } : undefined}
            >
              {hero.kicker}
            </span>
          </div>
          <h1
            className="font-display text-display-lg text-primary uppercase leading-none tracking-tighter"
            style={titleColor ? { color: titleColor } : undefined}
          >
            {hero.title}
          </h1>
          <p
            className="font-body text-body-lg text-secondary max-w-xl"
            style={subtitleColor ? { color: subtitleColor } : undefined}
          >
            {hero.subtitle}
          </p>
          <div className="mt-4 flex gap-4">
            <Link
              to={hero.primary_url}
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-on-primary font-label text-label-caps uppercase rounded-none hover:bg-forest-green transition-colors"
              style={
                c.primaryBg || c.primaryText
                  ? { backgroundColor: c.primaryBg, color: c.primaryText }
                  : undefined
              }
            >
              {hero.primary_cta}
            </Link>
            <Link
              to={hero.secondary_url}
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-primary text-primary font-label text-label-caps uppercase rounded-none transition-colors"
              style={
                c.secondaryBg || c.secondaryBorder || c.secondaryText || hero.text_color
                  ? {
                      backgroundColor: c.secondaryBg,
                      borderColor: c.secondaryBorder || hero.text_color || undefined,
                      color: c.secondaryText || hero.text_color || undefined,
                    }
                  : undefined
              }
            >
              {hero.secondary_cta}
            </Link>
          </div>
        </div>
      </section>

      {/* Trending Collections (Bento) */}
      {trending.length > 0 && (
        <section className="py-16 px-4 md:px-8 max-w-[1440px] mx-auto">
          <div className="flex justify-between items-end mb-12 border-b border-surface-container-high pb-4">
            <h2 className="font-headline text-headline-lg text-primary uppercase">
              {master.trending_title || "THE EDEN COLLECTION"}
            </h2>
            <Link
              to={master.trending_view_all_url}
              className="font-label text-label-caps text-secondary hover:text-forest-green transition-colors flex items-center gap-2"
            >
              {master.trending_view_all_label}{" "}
              <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[400px]">
            {trending.slice(0, 2).map((collection: Collection, index: number) => (
              <BentoCard key={collection.id} collection={collection} large={index === 0} />
            ))}
          </div>
        </section>
      )}

      {/* Latest Drops */}
      <section className="py-16 px-4 md:px-8 max-w-[1440px] mx-auto">
        <h2 className="font-headline text-headline-lg text-primary uppercase mb-12">
          {master.latest_drops_title || "LATEST DROPS"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {latestDrops.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div className="mt-12 flex justify-center">
          <Link
            to="/products"
            className="px-8 py-4 bg-transparent border border-primary text-primary font-label text-label-caps uppercase rounded-none hover:bg-forest-green hover:border-forest-green hover:text-white transition-colors"
          >
            {t("viewAllProducts")}
          </Link>
        </div>
      </section>

      {/* Master Section */}
      <section className="py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 h-auto md:h-[716px] min-h-[500px]">
          <div className="bg-surface-container-low p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-outline-variant">
            <h2 className="font-display text-display-lg text-primary uppercase leading-none mb-6 whitespace-pre-line">
              {master.title}
            </h2>
            <p className="font-body text-body-lg text-secondary mb-8 max-w-md">
              {master.description}
            </p>
            <div className="space-y-4">
              {(master.features || []).map((feature) => (
                <div key={feature.index} className="flex items-center gap-4 border-b border-outline-variant pb-4">
                  <span className="font-label text-label-caps text-forest-green">{feature.index}</span>
                  <span className="font-label text-label-caps text-primary">{feature.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative bg-surface-container-low h-full min-h-[400px] overflow-hidden">
            {master.media && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${master.media}')` }}
              />
            )}
            <div className="absolute inset-0 bg-white/10" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 border-2 border-forest-green rounded-full flex items-center justify-center backdrop-blur-sm bg-white/50 text-forest-green">
                <Icon name="play_arrow" className="text-[32px]" weight="fill" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function BentoCard({ collection, large }: { collection: Collection; large: boolean }) {
  const image = collection.hero_media?.url;
  return (
    <Link
      to={`/collections/${collection.slug}`}
      className={`${large ? "md:col-span-8" : "md:col-span-4"} relative group overflow-hidden bg-surface-container-low cursor-pointer`}
    >
      {image && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-100 group-hover:scale-105 origin-center"
          style={{ backgroundImage: `url('${image}')` }}
        />
      )}
      <div className="absolute inset-0 bg-white/20 group-hover:bg-transparent transition-all duration-500" />
      <div className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-surface-container-lowest to-transparent ${large ? "p-8" : "p-6"}`}>
        <h3 className="font-headline text-headline-md text-primary mb-2">{collection.name}</h3>
        <p className="font-label text-label-caps text-secondary">{collection.tagline}</p>
      </div>
    </Link>
  );
}
