import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProject, getProjectPages, getCoverThumbUrl, getCoverUrl, getPhotobookSettings } from "@/lib/photobook";
import { StepIndicator } from "@/components/photobook/step-indicator";
import { StepNav } from "@/components/photobook/step-nav";
import { BookPreview3D } from "@/components/photobook/book-preview-3d";
import { AddToCartButton } from "./_components/add-to-cart-placeholder";

export const metadata = { title: "Vista previa — Fotolibro" };
export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();

  // Prefer the cover thumbnail so the 3D book reuses the same image
  // assets already in the browser cache from earlier steps. Fall back to
  // the full image only if the thumb hasn't been generated yet.
  const [pages, coverThumb, coverFull, settings] = await Promise.all([
    getProjectPages(projectId),
    getCoverThumbUrl(project),
    getCoverUrl(project),
    getPhotobookSettings(),
  ]);
  const coverUrl = coverThumb ?? coverFull;

  const filledCount = pages.filter((p) => p.image_url).length;

  return (
    <>
      <StepIndicator projectId={projectId} current="preview" />

      <div className="flex flex-col items-center gap-8 py-6">
        <h2 className="text-2xl font-bold">Vista previa de tu fotolibro</h2>

        <BookPreview3D project={project} coverUrl={coverUrl} pages={pages} />

        {filledCount > 0 ? (
          <AddToCartButton
            projectId={projectId}
            sizeCm={project.size_cm}
            pageCount={project.page_count}
            settings={settings}
          />
        ) : null}
      </div>

      <StepNav back={{ href: `/fotolibro/${projectId}/paginas` }} />
    </>
  );
}
