import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "../components/Icon";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../i18n";
import { normalizeHomeSections, type HomeSectionConfig } from "../homeSections";
import CoverMedia from "../components/CoverMedia";
import type { HeroSlide } from "../mediaUtils";
import RevealOnScroll from "../components/RevealOnScroll";
import type { Collection, HomeData } from "../types";

export default function Home() {
  const { lang, t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["home", lang],
    queryFn: () => api.getHome(lang),
  });

  if (isLoading || !data) {
    return <main className="pt-20 min-h-[40vh]" aria-hidden />;
  }

  const sections = normalizeHomeSections(data.sections);

  return (
    <main className="pt-20">
      {sections.map((section, index) => (
        <RevealOnScroll
          key={section.id}
          immediate={section.id === "hero"}
          delay={section.id === "hero" ? 0 : Math.min(index * 70, 280)}
        >
          <HomeSectionBlock section={section} data={data} t={t} />
        </RevealOnScroll>
      ))}
    </main>
  );
}

function HomeSectionBlock({
  section,
  data,
  t,
}: {
  section: HomeSectionConfig;
  data: HomeData;
  t: (key: string) => string;
}) {
  if (!section.enabled) return null;

  const { hero, trending, latest_drops: latestDrops, master } = data;

  switch (section.id) {
    case "hero":
      return <HomeHero hero={hero} />;
    case "trending": {
      const limit = section.limit ?? 2;
      const items = trending.slice(0, limit);
      if (items.length === 0) return null;
      return (
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
          <div
            className={`grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[400px] ${
              limit === 1 ? "" : ""
            }`}
          >
            {items.map((collection: Collection, index: number) => (
              <BentoCard
                key={collection.id}
                collection={collection}
                large={limit > 1 && index === 0}
                fullWidth={limit === 1}
              />
            ))}
          </div>
        </section>
      );
    }
    case "latest_drops": {
      const limit = section.limit ?? 8;
      const showViewAll = section.show_view_all !== false;
      const products = latestDrops.slice(0, limit);
      if (products.length === 0) return null;
      return (
        <section className="py-16 px-4 md:px-8 max-w-[1440px] mx-auto">
          <h2 className="font-headline text-headline-lg text-primary uppercase mb-12">
            {master.latest_drops_title || "LATEST DROPS"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {showViewAll && (
            <div className="mt-12 flex justify-center">
              <Link
                to="/products"
                className="inline-flex items-center justify-center px-6 py-2.5 bg-transparent border border-primary text-primary font-label text-label-caps uppercase rounded-none hover:bg-forest-green hover:border-forest-green hover:text-white transition-colors"
              >
                {t("viewAllProducts")}
              </Link>
            </div>
          )}
        </section>
      );
    }
    case "master":
      return (
        <section className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 h-auto md:h-[716px] min-h-[500px]">
            <div className="bg-surface-container-low p-6 md:p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-outline-variant">
              <h2 className="font-display text-display-lg-mobile md:text-display-lg text-primary uppercase leading-none mb-6 whitespace-pre-line">
                {master.title}
              </h2>
              <p className="font-body text-body-lg text-secondary mb-8 max-w-md">{master.description}</p>
              <div className="space-y-4">
                {(master.features || []).map((feature) => (
                  <div key={feature.index} className="flex items-center gap-4 border-b border-outline-variant pb-4">
                    <span className="font-label text-label-caps text-forest-green">{feature.index}</span>
                    <span className="font-label text-label-caps text-primary">{feature.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <MasterMediaPanel url={master.media} mediaType={master.media_type} />
          </div>
        </section>
      );
    default:
      return null;
  }
}

function MasterMediaPanel({
  url,
  mediaType,
}: {
  url: string | null;
  mediaType?: "image" | "video" | null;
}) {
  const isVideo = Boolean(url && mediaType === "video");

  return (
    <div className="relative bg-surface-container-low h-full min-h-[400px] overflow-hidden">
      {url ? (
        <CoverMedia slide={{ url, media_type: mediaType ?? undefined }} />
      ) : null}
      <div className="absolute inset-0 bg-white/10 pointer-events-none" />
      {!isVideo && url ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 border-2 border-forest-green rounded-full flex items-center justify-center backdrop-blur-sm bg-white/50 text-forest-green">
            <Icon name="play_arrow" className="text-[32px]" weight="fill" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HomeHero({ hero }: { hero: HomeData["hero"] }) {
  const heroSlides: HeroSlide[] = (hero.slides || []).filter((s): s is HeroSlide => Boolean(s?.url));
  const slideUrls = (hero.images || []).filter((u): u is string => Boolean(u));
  const fallbackSlides: HeroSlide[] =
    slideUrls.length > 0
      ? slideUrls.map((url) => ({ url }))
      : hero.image
        ? [{ url: hero.image }]
        : [];
  const slides = heroSlides.length > 0 ? heroSlides : fallbackSlides;
  const heroImages = slides.map((s) => s.url);
  const autoCarousel = Boolean(hero.carousel) && heroImages.length > 1;
  const [slide, setSlide] = useState(0);
  const intervalMs = Math.max(1000, (hero.interval ?? 5) * 1000);

  useEffect(() => {
    setSlide(0);
  }, [slideUrls.join("|")]);

  useEffect(() => {
    if (!autoCarousel) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % heroImages.length), intervalMs);
    return () => clearInterval(id);
  }, [autoCarousel, heroImages.length, intervalMs]);

  const activeSlide = heroImages.length > 0 ? slide % heroImages.length : 0;
  const c = hero.colors || {};
  const titleColor = c.title || hero.text_color || undefined;
  const subtitleColor = c.subtitle || hero.text_color || undefined;

  return (
    <section className="relative w-full min-h-[min(520px,85vh)] sm:min-h-[600px] h-[70vh] sm:h-[780px] lg:h-[870px] max-h-[870px] flex items-end pb-10 sm:pb-16 px-4 sm:px-8 max-w-[1440px] mx-auto overflow-hidden">
      <div className="absolute inset-0 z-0 bg-surface-container-low">
        {slides.length > 0 ? (
          slides.map((slide, i) => (
            <div
              key={`${slide.url}-${i}`}
              className="absolute inset-0 transition-opacity duration-700"
              style={{ opacity: i === activeSlide ? 1 : 0 }}
            >
              <CoverMedia slide={slide} />
            </div>
          ))
        ) : null}
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
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-start gap-4 pr-4 md:pr-16">
        <div className="bg-forest-green px-3 py-1 inline-block" style={c.kickerBg ? { backgroundColor: c.kickerBg } : undefined}>
          <span
            className="font-label text-label-caps text-white uppercase tracking-widest font-bold"
            style={c.kickerText ? { color: c.kickerText } : undefined}
          >
            {hero.kicker}
          </span>
        </div>
        <h1
          className="font-display text-display-lg-mobile sm:text-display-lg text-primary uppercase leading-none tracking-tighter"
          style={titleColor ? { color: titleColor } : undefined}
        >
          {hero.title}
        </h1>
        <p
          className="font-body text-body-lg text-secondary max-w-4xl leading-relaxed text-pretty"
          style={subtitleColor ? { color: subtitleColor } : undefined}
        >
          {hero.subtitle}
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
          <Link
            to={hero.primary_url}
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 bg-primary text-on-primary font-label text-label-caps uppercase rounded-none hover:bg-forest-green transition-colors text-center"
            style={c.primaryBg || c.primaryText ? { backgroundColor: c.primaryBg, color: c.primaryText } : undefined}
          >
            {hero.primary_cta}
          </Link>
          <Link
            to={hero.secondary_url}
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 bg-transparent border border-primary text-primary font-label text-label-caps uppercase rounded-none transition-colors text-center"
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
  );
}

function BentoCard({
  collection,
  large,
  fullWidth,
}: {
  collection: Collection;
  large: boolean;
  fullWidth?: boolean;
}) {
  const span = fullWidth ? "md:col-span-12" : large ? "md:col-span-8" : "md:col-span-4";
  return (
    <Link
      to={`/collections/${collection.slug}`}
      className={`${span} relative group overflow-hidden bg-surface-container-low cursor-pointer`}
    >
      {collection.hero_media ? (
        <div className="absolute inset-0 transition-all duration-700 scale-100 group-hover:scale-105 origin-center">
          <CoverMedia media={collection.hero_media} />
        </div>
      ) : null}
      <div className="absolute inset-0 bg-white/20 group-hover:bg-transparent transition-all duration-500" />
      <div
        className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-surface-container-lowest to-transparent ${large ? "p-8" : "p-6"}`}
      >
        <h3 className="font-headline text-headline-md text-primary mb-2">{collection.name}</h3>
        <p className="font-label text-label-caps text-secondary">{collection.tagline}</p>
      </div>
    </Link>
  );
}
