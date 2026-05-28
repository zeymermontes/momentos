import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getProject,
  getProjectPages,
  getCoverThumbUrl,
  getPhotobookSettings,
} from "@/lib/photobook";
import { StepIndicator } from "@/components/photobook/step-indicator";
import { StepNav } from "@/components/photobook/step-nav";
import { PagesGrid } from "@/components/photobook/pages-grid";

export const metadata = { title: "Páginas — Fotolibro" };
export const dynamic = "force-dynamic";

export default async function PagesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { user } = await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();

  const [pages, settings, coverThumbUrl] = await Promise.all([
    getProjectPages(projectId),
    getPhotobookSettings(),
    // Sign the cover thumb here so the next step (preview) reuses the
    // cached signed URL. We also emit a <link rel="preload"> so the
    // browser starts fetching the cover bytes in parallel with the user
    // browsing this page.
    getCoverThumbUrl(project),
  ]);

  return (
    <>
      {coverThumbUrl ? (
        <link rel="preload" as="image" href={coverThumbUrl} />
      ) : null}
      <StepIndicator projectId={projectId} current="paginas" />
      <PagesGrid projectId={projectId} pages={pages} userId={user.id} currentPageCount={project.page_count} sizeCm={project.size_cm} settings={settings} />
      <StepNav
        back={{ href: `/fotolibro/${projectId}/portada` }}
        next={{ href: `/fotolibro/${projectId}/preview` }}
      />
    </>
  );
}
