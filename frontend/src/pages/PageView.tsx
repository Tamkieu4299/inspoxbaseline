import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import BlockRenderer from "../components/BlockRenderer";
import { useLanguage } from "../i18n";

export default function PageView() {
  const { lang, t } = useLanguage();
  const { slug } = useParams();
  const { data: page, isLoading, isError } = useQuery({
    queryKey: ["page", slug, lang],
    queryFn: () => api.getPage(slug as string, lang),
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) {
    return (
      <main className="pt-20 max-w-[1440px] mx-auto px-8 py-16">
        <p className="font-body text-body-md text-secondary">{t("loading")}</p>
      </main>
    );
  }

  if (isError || !page) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="pt-20">
      <section className="relative w-full h-[420px] min-h-[320px] flex items-end pb-14 px-8 max-w-[1440px] mx-auto overflow-hidden">
        {page.hero_media?.url && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${page.hero_media.url}')` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/60 to-transparent" />
        <div className="relative z-10 max-w-3xl flex flex-col items-start gap-3">
          <h1 className="font-display text-display-lg-mobile md:text-display-lg text-primary uppercase leading-none tracking-tighter">
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="font-body text-body-lg text-secondary max-w-xl">{page.subtitle}</p>
          )}
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 max-w-[1440px] mx-auto">
        <div className="max-w-3xl mx-auto flex flex-col gap-10">
          {page.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} />
          ))}
        </div>
      </section>
    </main>
  );
}
