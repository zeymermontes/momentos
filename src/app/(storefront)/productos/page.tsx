import Link from "next/link";
import { ArrowRight, BookOpen, Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { CategoryBannerCarousel } from "@/app/(storefront)/productos/_components/category-banner-carousel";
import { createClient } from "@/lib/supabase/server";
import { getPhotobookSettings } from "@/lib/photobook";
import type { PhotobookSize } from "@/lib/photobook-config";
import { formatMXN, cn } from "@/lib/utils";

/** Reserved slug for the built-in photobook "category" — not a DB row. */
const PHOTOBOOK_SLUG = "fotolibros";

export const metadata = { title: "Productos" };
export const revalidate = 60;

type SearchParams = Promise<{ categoria?: string; q?: string }>;

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

type CategoryNode = CategoryRow & { children: CategoryNode[] };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { categoria, q } = await searchParams;
  const supabase = await createClient();

  const [{ data: rawCategories }, photobookSettings] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, parent_id, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    getPhotobookSettings(),
  ]);

  const categories = (rawCategories ?? []) as CategoryRow[];
  const tree = buildTree(categories);
  const photobookActive =
    photobookSettings.enabled && categoria === PHOTOBOOK_SLUG;

  let activeCategory: CategoryRow | null = null;
  let categoryIds: string[] = [];
  if (categoria && !photobookActive) {
    const match = categories.find((c) => c.slug === categoria);
    if (match) {
      activeCategory = match;
      categoryIds = collectDescendantIds(match.id, categories);
    }
  }

  // Resolve the set of product ids that match the category filter (including
  // multi-category links via product_categories) BEFORE the main products
  // query, so we can fetch a single page of products with all filters applied.
  let productIdFilter: string[] | null = null;
  if (categoryIds.length > 0) {
    const [{ data: primary }, { data: linked }] = await Promise.all([
      supabase
        .from("products")
        .select("id")
        .in("category_id", categoryIds),
      supabase
        .from("product_categories")
        .select("product_id")
        .in("category_id", categoryIds),
    ]);
    const ids = new Set<string>();
    for (const p of primary ?? []) ids.add(p.id);
    for (const link of linked ?? []) ids.add(link.product_id);
    productIdFilter = Array.from(ids);
  }

  // Banners for the active category — one or many; the carousel handles both.
  type CategoryBannerRow = {
    id: string;
    title: string;
    subtitle: string | null;
    image_url: string;
    link_url: string | null;
  };
  let categoryBanners: CategoryBannerRow[] = [];
  if (activeCategory) {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("banners")
      .select("id, title, subtitle, image_url, link_url, starts_at, ends_at")
      .eq("position", "category")
      .eq("category_id", activeCategory.id)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    // Filter time windows in JS — Postgres doesn't make it easy with NULLs.
    categoryBanners = (data ?? []).filter((b) => {
      const startOk = !b.starts_at || b.starts_at <= nowIso;
      const endOk = !b.ends_at || b.ends_at > nowIso;
      return startOk && endOk;
    });
  }

  let query = supabase
    .from("products")
    .select("id, slug, name, base_price, images, is_customizable, requires_file")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (productIdFilter !== null) {
    if (productIdFilter.length === 0) {
      // Filter set is non-empty but no products matched — short-circuit so
      // we don't fetch everything by skipping the where clause.
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("id", productIdFilter);
    }
  }
  if (q) query = query.ilike("name", `%${q}%`);

  // The photobook pseudo-category renders its own size grid — skip the
  // products fetch entirely.
  const { data: products } = photobookActive ? { data: null } : await query;

  // Photobook size cards also surface in the unfiltered "Todas" view (and
  // respect the search box) so the flagship product is never hidden.
  const photobookSizes =
    photobookSettings.enabled && (photobookActive || !categoria)
      ? photobookSettings.sizes.filter(
          (s) =>
            !q ||
            `fotolibro ${s.label} ${s.sublabel}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
      : [];
  const photobookMaxCm =
    photobookSizes.length > 0
      ? Math.max(...photobookSizes.map((s) => s.cm))
      : 1;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {categoryBanners.length > 0 ? (
        <div className="mb-8">
          <CategoryBannerCarousel banners={categoryBanners} />
        </div>
      ) : null}

      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {photobookActive
            ? "Fotolibros"
            : activeCategory
              ? activeCategory.name
              : "Todos los productos"}
        </h1>
        <form className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Buscar productos..."
            defaultValue={q ?? ""}
            className="pl-9"
          />
          {categoria ? (
            <input type="hidden" name="categoria" value={categoria} />
          ) : null}
        </form>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorías
          </p>
          <Link
            href="/productos"
            className={cn(
              "block rounded-md px-3 py-2 text-sm hover:bg-muted",
              !categoria && "bg-muted font-medium",
            )}
          >
            Todas
          </Link>
          {photobookSettings.enabled ? (
            <Link
              href={`/productos?categoria=${PHOTOBOOK_SLUG}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm hover:bg-muted",
                photobookActive && "bg-muted font-medium",
              )}
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              Fotolibros
            </Link>
          ) : null}
          {tree.map((node) => (
            <CategoryLink
              key={node.id}
              node={node}
              depth={0}
              activeSlug={categoria}
            />
          ))}
        </aside>

        <div>
          {photobookActive ? (
            <PhotobookSizeGrid sizes={photobookSizes} maxCm={photobookMaxCm} />
          ) : (products?.length ?? 0) === 0 && photobookSizes.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No encontramos productos"
              description={
                q
                  ? `Sin resultados para "${q}".`
                  : "Aún no hay productos publicados en esta categoría."
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {photobookSizes.map((s) => (
                <PhotobookSizeCard
                  key={`pb-${s.cm}`}
                  size={s}
                  maxCm={photobookMaxCm}
                />
              ))}
              {(products ?? []).map((p) => {
                const imgs = Array.isArray(p.images)
                  ? (p.images as string[])
                  : [];
                return (
                  <Link
                    key={p.id}
                    href={`/productos/${p.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-muted">
                      {imgs[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgs[0]}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : null}
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                        {p.is_customizable ? (
                          <Badge variant="default">Personalizable</Badge>
                        ) : null}
                        {p.requires_file ? (
                          <Badge variant="secondary">Sube tu diseño</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="text-sm font-semibold leading-tight">
                        {p.name}
                      </h3>
                      <p className="mt-auto pt-1.5 text-base font-bold">
                        {formatMXN(Number(p.base_price))}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Card grid for the built-in "Fotolibros" pseudo-category: one card per
 * configured size, each linking into the photobook flow with that size
 * preselected (`/fotolibro?size=NN`). The cover visual scales with the
 * physical size so the options read at a glance.
 */
function PhotobookSizeGrid({
  sizes,
  maxCm,
}: {
  sizes: PhotobookSize[];
  maxCm: number;
}) {
  if (sizes.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Sin tamaños disponibles"
        description="Aún no hay tamaños de fotolibro configurados."
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {sizes.map((s) => (
        <PhotobookSizeCard key={s.cm} size={s} maxCm={maxCm} />
      ))}
    </div>
  );
}

function PhotobookSizeCard({
  size: s,
  maxCm,
}: {
  size: PhotobookSize;
  maxCm: number;
}) {
  const prices = Object.values(s.prices ?? {})
    .map(Number)
    .filter((p) => Number.isFinite(p) && p > 0);
  const from = prices.length > 0 ? Math.min(...prices) : null;
  // Scale each cover relative to the largest size (45%–80% of the tile).
  const coverPct = 45 + (s.cm / maxCm) * 35;
  return (
    <Link
      href={`/fotolibro?size=${s.cm}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="grid aspect-square w-full place-items-center overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/20">
        <div
          className="relative overflow-hidden rounded-lg bg-secondary shadow-lg ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-105"
          style={{ width: `${coverPct}%`, aspectRatio: "1 / 1" }}
        >
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/40 to-transparent"
          />
          <div className="grid h-full w-full place-items-center">
            <div className="text-center">
              <BookOpen className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-1 text-[10px] font-semibold tracking-wide text-white/70">
                {s.sublabel}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-sm font-semibold leading-tight">
          Fotolibro {s.label}
        </h3>
        <p className="text-xs text-muted-foreground">{s.sublabel}</p>
        <div className="mt-auto flex items-end justify-between pt-1.5">
          {from !== null ? (
            <p className="text-base font-bold">
              <span className="text-xs font-medium text-muted-foreground">
                Desde{" "}
              </span>
              {formatMXN(from)}
            </p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              Configúralo a tu gusto
            </p>
          )}
          <ArrowRight className="mb-1 h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function CategoryLink({
  node,
  depth,
  activeSlug,
}: {
  node: CategoryNode;
  depth: number;
  activeSlug: string | undefined;
}) {
  return (
    <>
      <Link
        href={`/productos?categoria=${node.slug}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        className={cn(
          "block rounded-md py-2 pr-3 text-sm hover:bg-muted",
          activeSlug === node.slug && "bg-muted font-medium",
        )}
      >
        {depth > 0 ? (
          <span className="mr-1 text-muted-foreground">›</span>
        ) : null}
        {node.name}
      </Link>
      {node.children.map((child) => (
        <CategoryLink
          key={child.id}
          node={child}
          depth={depth + 1}
          activeSlug={activeSlug}
        />
      ))}
    </>
  );
}

function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>(
    rows.map((r) => [r.id, { ...r, children: [] }]),
  );
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortLevel = (list: CategoryNode[]) => {
    list.sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    list.forEach((n) => sortLevel(n.children));
  };
  sortLevel(roots);
  return roots;
}

/**
 * Return the id of `rootId` plus the ids of all its descendants (depth-first).
 * Used when filtering products: clicking a parent category should also list
 * products tagged under any of its children.
 */
function collectDescendantIds(rootId: string, rows: CategoryRow[]): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const r of rows) {
    if (r.parent_id) {
      const arr = childrenByParent.get(r.parent_id) ?? [];
      arr.push(r.id);
      childrenByParent.set(r.parent_id, arr);
    }
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    const children = childrenByParent.get(id);
    if (children) stack.push(...children);
  }
  return out;
}
