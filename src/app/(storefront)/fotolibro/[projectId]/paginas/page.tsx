import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProject, getProjectPages, getPhotobookSettings } from "@/lib/photobook";
import { StepIndicator } from "@/components/photobook/step-indicator";
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

  const [pages, settings] = await Promise.all([
    getProjectPages(projectId),
    getPhotobookSettings(),
  ]);

  return (
    <>
      <StepIndicator projectId={projectId} current="paginas" />
      <PagesGrid projectId={projectId} pages={pages} userId={user.id} currentPageCount={project.page_count} sizeCm={project.size_cm} settings={settings} />
    </>
  );
}
