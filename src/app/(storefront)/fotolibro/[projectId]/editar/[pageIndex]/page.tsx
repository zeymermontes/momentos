import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProject, getProjectPages } from "@/lib/photobook";
import { PageEditor } from "@/components/photobook/page-editor";

export const metadata = { title: "Editar página — Fotolibro" };
export const dynamic = "force-dynamic";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ projectId: string; pageIndex: string }>;
}) {
  const { projectId, pageIndex } = await params;
  const sortOrder = Number(pageIndex);
  if (!Number.isFinite(sortOrder) || sortOrder < 1) notFound();

  const { user } = await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();

  const pages = await getProjectPages(projectId);
  const page = pages.find((p) => p.sort_order === sortOrder);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/fotolibro/${projectId}/paginas`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a páginas
      </Link>
      <PageEditor projectId={projectId} page={page} userId={user.id} />
    </div>
  );
}
