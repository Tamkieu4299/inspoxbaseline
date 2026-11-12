/** Legacy import categories; brand is filtered via product.brand instead. */
export function isBrandCategorySlug(slug: string) {
  return slug.startsWith("brand-");
}

export type CategoryNavItem = {
  id: number;
  slug: string;
  name: string;
  parent_id?: number | null;
};

export function filterStorefrontCategories<T extends { slug: string }>(categories: T[] | undefined) {
  return (categories || []).filter((c) => !isBrandCategorySlug(c.slug));
}

/** Product filters / collection sidebar: leaf categories + top-level categories without children. */
export function navCategories<T extends CategoryNavItem>(categories: T[] | undefined) {
  const cats = filterStorefrontCategories(categories);
  const parentIds = new Set(
    cats.map((c) => c.parent_id).filter((id): id is number => typeof id === "number")
  );
  return cats.filter((c) => !parentIds.has(c.id));
}

export type CategoryMenuNode = {
  label: string;
  to: string;
  slug: string;
  children?: CategoryMenuNode[];
};

export type CategoryMenuLink = {
  label: string;
  to: string;
  indent?: boolean;
};

function buildCategoryMaps(categories: CategoryNavItem[] | undefined) {
  const cats = filterStorefrontCategories(categories);
  const byParent = new Map<number, CategoryNavItem[]>();
  const roots: CategoryNavItem[] = [];
  for (const c of cats) {
    if (c.parent_id) {
      const list = byParent.get(c.parent_id) || [];
      list.push(c);
      byParent.set(c.parent_id, list);
    } else {
      roots.push(c);
    }
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));
  return { byParent, roots };
}

function toMenuNode(c: CategoryNavItem, children?: CategoryMenuNode[]): CategoryMenuNode {
  return {
    label: c.name,
    slug: c.slug,
    to: `/products?category=${c.slug}`,
    children: children?.length ? children : undefined,
  };
}

/** Navbar desktop flyout: root categories; children open to the right on hover. */
export function categoryMenuTree(categories: CategoryNavItem[] | undefined): CategoryMenuNode[] {
  const { byParent, roots } = buildCategoryMaps(categories);
  if (!roots.length) return [];

  return roots.map((root) => {
    const kids = (byParent.get(root.id) || []).sort((a, b) => a.name.localeCompare(b.name));
    if (!kids.length) return toMenuNode(root);
    return toMenuNode(
      root,
      kids.map((child) => toMenuNode(child))
    );
  });
}

/** Footer / flat lists: leaf links only when a root has children. */
export function categoryMenuLinks(categories: CategoryNavItem[] | undefined): CategoryMenuLink[] {
  const tree = categoryMenuTree(categories);
  const out: CategoryMenuLink[] = [];
  for (const node of tree) {
    if (node.children?.length) {
      for (const child of node.children) {
        out.push({ label: child.label, to: child.to });
      }
    } else {
      out.push({ label: node.label, to: node.to });
    }
  }
  return out;
}
