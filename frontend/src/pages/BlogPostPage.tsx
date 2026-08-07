import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import BlockRenderer from "../components/BlockRenderer";
import { useLanguage } from "../i18n";

function formatDate(date: string, lang: string) {
  return new Date(date).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPostPage() {
  const { lang, t } = useLanguage();
  const { slug } = useParams();
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["blog-post", slug, lang],
    queryFn: () => api.getBlogPost(slug as string, lang),
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

  if (isError || !post) {
    return <Navigate to="/blogs" replace />;
  }

  return (
    <main className="pt-20 py-16 px-4 md:px-8 max-w-[1440px] mx-auto">
      <Link
        to="/blogs"
        className="font-label text-label-caps text-secondary hover:text-forest-green transition-colors inline-block mb-8"
      >
        {t("blog.back")}
      </Link>
      <article className="max-w-3xl mx-auto flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          {post.published_at && (
            <span className="font-label text-label-caps text-secondary">
              {formatDate(post.published_at, lang)}
            </span>
          )}
          <h1 className="font-display text-display-lg-mobile md:text-display-lg text-primary uppercase leading-none tracking-tighter">
            {post.title}
          </h1>
          {post.excerpt && <p className="font-body text-body-lg text-secondary">{post.excerpt}</p>}
        </header>
        {post.cover_media?.url && (
          <img
            src={post.cover_media.url}
            alt={post.title}
            className="w-full max-h-[520px] object-cover"
          />
        )}
        <div className="flex flex-col gap-8">
          {post.content.map((block, index) => (
            <BlockRenderer key={index} block={block} />
          ))}
        </div>
      </article>
    </main>
  );
}
