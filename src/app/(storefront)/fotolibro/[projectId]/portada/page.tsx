import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProject, getCoverUrl } from "@/lib/photobook";
import { StepIndicator } from "@/components/photobook/step-indicator";
import { CoverEditor } from "@/components/photobook/cover-editor";

export const metadata = { title: "Portada — Fotolibro" };

export default async function CoverPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { user } = await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();

  const coverUrl = await getCoverUrl(project);

  return (
    <>
      <StepIndicator projectId={projectId} current="portada" />
      <CoverEditor project={project} coverUrl={coverUrl} userId={user.id} />
    </>
  );
}
