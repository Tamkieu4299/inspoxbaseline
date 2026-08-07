import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type { BlogPost } from "../types";

function formatDate(date: string, lang: string) {
  return new Date(date).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogsPage() {
  const { lang, t } = useLanguage();
  const { data: blog, isLoading: pageLoading, isError: pageError } = useQuery({
    queryKey: ["page", "blogs", lang],
    queryFn: () => api.getPage("blogs", lang),
    retry: false,
  });
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["blog-posts", lang],
    queryFn: () => api.getBlogPosts(lang),
  });

  if (pageLoading || postsLoading) {
    return (
      <main className="pt-20 max-w-[1440px] mx-auto px-8 py-16">
        <p className="font-body text-body-md text-secondary">{t("loading")}</p>
      </main>
    );
  }

  if (pageError || !blog) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="pt-20">
      <section className="relative w-full h-[420px] min-h-[320px] flex items-end pb-14 px-8 max-w-[1440px] mx-auto overflow-hidden">
        {blog.hero_media?.url && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${blog.hero_media.url}')` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/60 to-transparent" />
        <div className="relative z-10 max-w-3xl flex flex-col items-start gap-3">
          <h1 className="font-display text-display-lg-mobile md:text-display-lg text-primary uppercase leading-none tracking-tighter">
            {blog.title}
          </h1>
          {blog.subtitle && (
            <p className="font-body text-body-lg text-secondary max-w-xl">{blog.subtitle}</p>
          )}
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(posts || []).map((post: BlogPost) => (
            <Link
              key={post.id}
              to={`/blogs/${post.slug}`}
              className="group flex flex-col border border-surface-container-high bg-white hover:border-forest-green transition-colors"
            >
              <div className="w-full aspect-[4/3] bg-surface-container-low overflow-hidden">
                {post.cover_media?.url && (
                  <img
                    src={post.cover_media.url}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
              </div>
              <div className="p-6 flex flex-col gap-2 flex-grow">
                {post.published_at && (
                  <span className="font-label text-label-caps text-secondary">
                    {formatDate(post.published_at, lang)}
                  </span>
                )}
                <h2 className="font-headline text-headline-md text-primary uppercase leading-tight group-hover:text-forest-green transition-colors">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="font-body text-body-md text-secondary">{post.excerpt}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
        {(!posts || posts.length === 0) && (
          <p className="font-body text-body-md text-secondary">{t("blog.noPosts")}</p>
        )}
      </section>
    </main>
  );
}
