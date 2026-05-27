import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/photobook";

export default async function PhotobookProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { user } = await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();
  if (project.user_id !== user.id) redirect("/fotolibro");

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</div>;
}
