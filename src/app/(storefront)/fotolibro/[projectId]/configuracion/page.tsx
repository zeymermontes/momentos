import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProject, getPhotobookSettings } from "@/lib/photobook";
import { StepIndicator } from "@/components/photobook/step-indicator";
import { ProjectConfigForm } from "./_components/project-config-form";

export const metadata = { title: "Configuración — Fotolibro" };
export const dynamic = "force-dynamic";

export default async function ProjectConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { projectId } = await params;
  const { size } = await searchParams;
  await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();

  const settings = await getPhotobookSettings();

  // Coming from a size card in the catalog: preselect that size in the
  // form (the customer still has to save for it to apply to the project).
  const requestedSize = Number(size);
  const initialSizeCm = settings.sizes.some((s) => s.cm === requestedSize)
    ? requestedSize
    : undefined;

  return (
    <>
      <StepIndicator projectId={projectId} current="configuracion" />
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Configuración del fotolibro</h2>
          <p className="text-sm text-muted-foreground">
            Puedes cambiar el tamaño y número de páginas de tu fotolibro.
          </p>
        </div>
        <ProjectConfigForm
          projectId={projectId}
          currentSizeCm={project.size_cm}
          currentPageCount={project.page_count}
          settings={settings}
          initialSizeCm={initialSizeCm}
        />
      </div>
    </>
  );
}
