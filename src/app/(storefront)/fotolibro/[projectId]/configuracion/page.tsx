import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProject, getPhotobookSettings } from "@/lib/photobook";
import { StepIndicator } from "@/components/photobook/step-indicator";
import { ProjectConfigForm } from "./_components/project-config-form";

export const metadata = { title: "Configuración — Fotolibro" };
export const dynamic = "force-dynamic";

export default async function ProjectConfigPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();

  const settings = await getPhotobookSettings();

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
        />
      </div>
    </>
  );
}
