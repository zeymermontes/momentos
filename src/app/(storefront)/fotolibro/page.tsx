import { redirect } from "next/navigation";
import Link from "next/link";
import { Book, Plus, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPhotobookSettings } from "@/lib/photobook";
import { getActivePromotionRules } from "@/lib/promotions";
import { getCart } from "@/lib/cart";
import { buttonVariants } from "@/components/ui/button";
import { ConfigForm } from "./_components/config-form";

export const metadata = { title: "Crear fotolibro" };

export default async function PhotobookConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string; nuevo?: string }>;
}) {
  const { size, nuevo } = await searchParams;
  const requestedSize = Number(size);
  const sizeQuery =
    Number.isFinite(requestedSize) && requestedSize > 0
      ? `?size=${requestedSize}`
      : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/fotolibro${sizeQuery}`)}`);

  const { data: activeProjects } = await supabase
    .from("photobook_projects")
    .select("id, title, size_cm, page_count, cover_thumb_path, updated_at")
    .eq("user_id", user.id)
    .in("status", ["draft", "completed"])
    .order("updated_at", { ascending: false });

  // A customer can have several books going at once (and several in the
  // cart). With at least one open, land on the list; `?nuevo=1` is the
  // explicit "start another one" path into the form below.
  const projects = activeProjects ?? [];
  if (projects.length > 0 && nuevo !== "1") {
    return (
      <ProjectList
        projects={await withCoversAndCartState(projects)}
        newHref={`/fotolibro?nuevo=1${sizeQuery.replace("?", "&")}`}
      />
    );
  }

  const [settings, promotionRules] = await Promise.all([
    getPhotobookSettings(),
    getActivePromotionRules(),
  ]);
  if (!settings.enabled) redirect("/");

  const initialSizeCm = settings.sizes.some((s) => s.cm === requestedSize)
    ? requestedSize
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center space-y-3">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10">
          <Book className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {projects.length > 0 ? "Crea otro fotolibro" : "Crea tu fotolibro"}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Elige el tamaño y número de páginas para tu fotolibro personalizado.
          Después diseñarás la portada y agregarás tus fotos.
        </p>
      </div>

      <ConfigForm
        settings={settings}
        initialSizeCm={initialSizeCm}
        promotionRules={promotionRules}
      />
    </div>
  );
}

type ProjectRow = {
  id: string;
  title: string;
  size_cm: number;
  page_count: number;
  cover_thumb_path: string | null;
  updated_at: string;
};

type ProjectCard = ProjectRow & { coverUrl: string | null; inCart: boolean };

async function withCoversAndCartState(
  projects: ProjectRow[],
): Promise<ProjectCard[]> {
  const supabase = await createClient();

  const inCartIds = new Set<string>();
  const cart = await getCart();
  if (cart) {
    const { data: items } = await supabase
      .from("cart_items")
      .select("customization")
      .eq("cart_id", cart.cartId);
    for (const item of items ?? []) {
      const c = item.customization as Record<string, unknown> | null;
      if (c?.type === "photobook" && c.photobook_project_id) {
        inCartIds.add(String(c.photobook_project_id));
      }
    }
  }

  const coverPaths = projects
    .map((p) => p.cover_thumb_path)
    .filter((path): path is string => Boolean(path));
  const coverUrls = new Map<string, string>();
  if (coverPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("customer-uploads")
      .createSignedUrls(coverPaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) coverUrls.set(s.path, s.signedUrl);
    }
  }

  return projects.map((p) => ({
    ...p,
    coverUrl: p.cover_thumb_path
      ? (coverUrls.get(p.cover_thumb_path) ?? null)
      : null,
    inCart: inCartIds.has(p.id),
  }));
}

function ProjectList({
  projects,
  newHref,
}: {
  projects: ProjectCard[];
  newHref: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tus fotolibros</h1>
          <p className="mt-1 text-muted-foreground">
            Continúa uno de tus fotolibros o empieza otro con fotos y diseño
            diferentes.
          </p>
        </div>
        <Link href={newHref} className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Crear otro fotolibro
        </Link>
      </div>

      <ul className="space-y-3">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/fotolibro/${p.id}/configuracion`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary"
            >
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Book className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.title || "Fotolibro sin título"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.size_cm}×{p.size_cm} cm · {p.page_count} páginas
                </p>
                {p.inCart ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    En tu carrito
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    En progreso
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium text-primary">
                {p.inCart ? "Editar" : "Continuar"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
