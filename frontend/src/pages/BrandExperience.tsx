import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import Icon from "../components/Icon";
import { useLanguage } from "../i18n";
import type { EditorialItem } from "../types";

export default function BrandExperience() {
  const { lang, t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["brand", lang],
    queryFn: () => api.getBrand(lang),
  });

  if (isLoading || !data) {
    return (
      <main className="pt-20 max-w-[1440px] mx-auto px-8 py-16 font-brand-body">
        <p className="text-body-md text-on-surface-variant">{t("loading")}</p>
      </main>
    );
  }

  return (
    <div className="font-brand-body bg-background text-on-background antialiased selection:bg-surface-variant selection:text-on-surface">
      {/* Hero */}
      <header className="relative w-full h-[819px] min-h-[600px] mt-20 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-surface z-0">
          {data.hero_image && (
            <img
              src={data.hero_image}
              alt=""
              className="w-full h-full object-cover opacity-80 mix-blend-multiply"
            />
          )}
          {data.hero_gradient !== false && (
            <div className="absolute inset-0 bg-gradient-to-t from-background to-white/20 opacity-100" />
          )}
        </div>
        <div className="relative z-10 text-center px-4 md:px-16 max-w-[1440px] mx-auto flex flex-col items-center">
          <h1
            className="font-brand-display text-[64px] md:text-[96px] text-primary uppercase tracking-tighter mb-4 leading-none"
            style={data.hero_text_color ? { color: data.hero_text_color } : undefined}
          >
            {data.hero_title}
          </h1>
          <p
            className="text-body-lg text-on-surface-variant max-w-2xl mb-8"
            style={data.hero_text_color ? { color: data.hero_text_color } : undefined}
          >
            {data.hero_subtitle}
          </p>
          <a
            href="#gallery"
            className="inline-flex items-center justify-center bg-primary text-on-primary font-brand-display text-base uppercase px-12 py-4 rounded-none hover:bg-inverse-surface transition-colors duration-300"
          >
            {data.hero_cta}
          </a>
        </div>
      </header>

      {/* Masonry Gallery */}
      <main className="w-full px-4 md:px-16 py-16 max-w-[1440px] mx-auto space-y-16" id="gallery">
        <section>
          <div className="flex justify-between items-end mb-8 border-b border-surface-variant pb-4">
            <h2 className="font-brand-display text-headline-lg-mobile md:text-headline-lg text-primary uppercase">
              {t("brand.lab")}
            </h2>
          </div>
          <div className="masonry-grid">
            {data.items.map((item) => (
              <MasonryItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function MasonryItem({ item }: { item: EditorialItem }) {
  if (item.kind === "quote") {
    return (
      <div className="masonry-item bg-surface-container p-12 flex flex-col justify-center min-h-[300px]">
        <Icon name="format_quote" className="text-4xl text-primary mb-4" />
        <blockquote className="font-brand-display text-headline-md text-primary uppercase mb-4">
          {item.quote}
        </blockquote>
        <p className="font-brand-label text-label-caps text-secondary">{item.author}</p>
      </div>
    );
  }

  if (item.kind === "product_grid") {
    return (
      <div className="masonry-item grid grid-cols-2 gap-1">
        {(item.content || []).map((cell, index) => (
          <Link
            key={index}
            to={cell.link_url || "/collections"}
            className="bg-surface relative group overflow-hidden h-48"
          >
            <img src={cell.url} alt={cell.alt || ""} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center opacity-0 translate-y-5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
              <span className="font-brand-label text-label-caps text-primary border border-primary px-4 py-2 hover:bg-primary hover:text-on-primary transition-colors">
                {cell.link_text}
              </span>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="masonry-item relative group overflow-hidden bg-surface">
      {item.media?.url && (
        <img
          src={item.media.url}
          alt={item.title || ""}
          className="w-full h-auto object-cover transition-all duration-500"
        />
      )}
      <div className="absolute inset-0 bg-white/90 flex flex-col justify-end p-4 opacity-0 translate-y-5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
        {item.subtitle && (
          <span className="font-brand-label text-label-caps text-secondary mb-1">{item.subtitle}</span>
        )}
        {item.title && (
          <h3 className="font-brand-display text-headline-md text-primary uppercase mb-2">{item.title}</h3>
        )}
        {item.link_text && (
          <Link
            to={item.link_url || "/collections"}
            className="inline-flex items-center font-brand-label text-label-caps text-primary hover:text-secondary transition-colors"
          >
            {item.link_text} <Icon name="arrow_forward" className="ml-2 text-sm" />
          </Link>
        )}
      </div>
    </div>
  );
}
