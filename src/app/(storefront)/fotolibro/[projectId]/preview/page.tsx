import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProject, getProjectPages, getCoverUrl, getPhotobookSettings } from "@/lib/photobook";
import { StepIndicator } from "@/components/photobook/step-indicator";
import { BookPreview3D } from "@/components/photobook/book-preview-3d";
import { AddToCartButton } from "./_components/add-to-cart-placeholder";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const [pages, coverUrl, settings] = await Promise.all([
    getProjectPages(projectId),
    getCoverUrl(project),
    getPhotobookSettings(),
  ]);

  const filledCount = pages.filter((p) => p.image_url).length;

  return (
    <>
      <StepIndicator projectId={projectId} current="preview" />

      <div className="flex flex-col items-center gap-8 py-6">
        <h2 className="text-2xl font-bold">Vista previa de tu fotolibro</h2>

        <BookPreview3D project={project} coverUrl={coverUrl} pages={pages} />

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/fotolibro/${projectId}/paginas`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <ArrowLeft className="h-4 w-4" />
            Editar páginas
          </Link>

          {filledCount > 0 && (
            <AddToCartButton
              projectId={projectId}
              sizeCm={project.size_cm}
              pageCount={project.page_count}
              settings={settings}
            />
          )}
        </div>
      </div>
    </>
  );
}
