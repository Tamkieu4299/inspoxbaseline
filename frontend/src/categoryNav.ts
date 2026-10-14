/** Legacy import categories; brand is filtered via product.brand instead. */
export function isBrandCategorySlug(slug: string) {
  return slug.startsWith("brand-");
}

export function navCategories<T extends { slug: string }>(categories: T[] | undefined) {
  return (categories || []).filter((c) => !isBrandCategorySlug(c.slug));
}
