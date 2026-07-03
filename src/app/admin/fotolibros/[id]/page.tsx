import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Book } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getProject, getProjectPages, getCoverUrl, getPrintSheetUrls } from "@/lib/photobook";
import { getPhotobookSettings, getPhotobookPrice } from "@/lib/photobook";
import { createClient } from "@/lib/supabase/server";
import { GenerateSheets } from "@/components/photobook/generate-sheets";
import { PageThumb } from "@/components/photobook/page-preview";
import { formatMXN } from "@/lib/utils";

export const metadata = { title: "Detalle fotolibro — Admin" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "En edición",
  completed: "Listo",
  ordered: "Pedido",
};

const STATUS_BADGE: Record<string, "warning" | "default" | "success"> = {
  draft: "warning",
  completed: "default",
  ordered: "success",
};

export default async function AdminPhotobookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const project = await getProject(id);
  if (!project) notFound();

  const [pages, coverUrl] = await Promise.all([
    getProjectPages(id),
    getCoverUrl(project),
  ]);

  const filledPages = pages.filter((p) => p.image_url);
  const settings = await getPhotobookSettings();

  // For an ordered project, the customer already paid a specific
  // unit_price that by construction includes pasta dura if it applied.
  // Prefer that over recomputing from settings — config might have
  // changed since the order.
  const supabase = await createClient();
  const { data: orderItemRow } = await supabase
    .from("order_items")
    .select("unit_price")
    .filter("customization->>photobook_project_id", "eq", project.id)
    .limit(1)
    .maybeSingle();
  const historicalPrice = orderItemRow
    ? Number(orderItemRow.unit_price)
    : null;
  const price =
    historicalPrice ??
    getPhotobookPrice(
      settings,
      project.size_cm,
      project.page_count,
      project.hardcover,
    );
  const existingSheets = project.print_sheets
    ? await getPrintSheetUrls(project.print_sheets)
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/fotolibros"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a fotolibros
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <Book className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{project.title || "Sin título"}</h2>
            <Badge variant={STATUS_BADGE[project.status] ?? "muted"}>
              {STATUS_LABEL[project.status] ?? project.status}
            </Badge>
            <Badge variant={project.hardcover ? "default" : "muted"}>
              {project.hardcover ? "Pasta dura" : "Pasta blanda"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.size_cm}×{project.size_cm} cm · {project.page_count} páginas ·
            {" "}{filledPages.length} fotos · {formatMXN(price)}
            {historicalPrice !== null ? (
              <span className="ml-1 text-xs text-muted-foreground/70">
                (precio pagado)
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            ID: {project.id}
          </p>
        </div>
      </div>

      {/* Cover */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold">Portada</h3>
          <div className="flex items-start gap-4">
            <div className="h-40 w-40 shrink-0 overflow-hidden bg-white shadow">
              {coverUrl ? (
                <div className="relative h-full w-full">
                  <PageThumb src={coverUrl} crop={project.cover_crop} />
                  {project.title && (
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center" style={{ height: "10%" }}>
                      <span className="text-[8px] font-semibold text-gray-700 truncate px-1">
                        {project.title}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid h-full w-full place-items-center bg-muted/20 text-muted-foreground text-xs">
                  Sin portada
                </div>
              )}
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Título:</span> {project.title || "—"}</p>
              <p><span className="text-muted-foreground">Crop:</span> x={project.cover_crop.x.toFixed(1)}, y={project.cover_crop.y.toFixed(1)}, zoom={project.cover_crop.scale.toFixed(2)}, rot={project.cover_crop.rotation ?? 0}°</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pages grid */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold">Páginas ({filledPages.length}/{project.page_count})</h3>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {pages.map((page) => {
              const src = page.thumb_url ?? page.image_url;
              return (
                <div
                  key={page.id}
                  className="relative aspect-square overflow-hidden bg-white shadow-sm border border-border"
                >
                  {src ? (
                    <PageThumb src={src} crop={page.crop} />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground/30">
                      <span className="text-[9px]">—</span>
                    </div>
                  )}
                  <span className="absolute bottom-0.5 left-1 text-[8px] text-gray-400">
                    {page.sort_order}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Print sheet generator */}
      {filledPages.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <GenerateSheets
              projectId={project.id}
              sizeCm={project.size_cm}
              pages={pages}
              userId={project.user_id}
              title={project.title}
              coverImageUrl={coverUrl}
              coverCrop={project.cover_crop}
              existingSheets={existingSheets}
              autoGenerate={project.status === "ordered"}
            />
          </CardContent>
        </Card>
      )}

      {/* Download links for production */}
      {project.status === "ordered" && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">Archivos para impresión</h3>
            <p className="text-sm text-muted-foreground">
              Las imágenes en alta resolución están en el bucket <code className="text-xs bg-muted px-1 py-0.5 rounded">customer-uploads</code> bajo
              {" "}<code className="text-xs bg-muted px-1 py-0.5 rounded">{project.user_id}/photobooks/{project.id}/</code>
            </p>
            <div className="space-y-1">
              {coverUrl && (
                <a href={coverUrl} target="_blank" rel="noreferrer" className="block text-xs text-primary hover:underline">
                  Descargar portada
                </a>
              )}
              {filledPages.map((p) => (
                <a
                  key={p.id}
                  href={p.image_url!}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-primary hover:underline"
                >
                  Página {p.sort_order} — Descargar
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
