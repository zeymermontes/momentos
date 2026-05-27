"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { runAction } from "@/lib/server-action";
import type { CropState } from "@/lib/photobook";
import type { Json } from "@/lib/supabase/database.types";

export type ActionState = { message?: string; errors?: Record<string, string[]> };

export async function createProjectAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const sizeCm = Number(formData.get("size_cm"));
    const pageCount = Number(formData.get("page_count"));
    if (![15, 20, 30].includes(sizeCm)) return { message: "Tamaño inválido." };
    if (![20, 40, 60].includes(pageCount)) return { message: "Número de páginas inválido." };

    const { supabase, user } = await requireUser();
    const { data: project, error } = await supabase
      .from("photobook_projects")
      .insert({ user_id: user.id, size_cm: sizeCm, page_count: pageCount })
      .select("id")
      .single();
    if (error || !project) return { message: error?.message ?? "No se pudo crear el proyecto." };

    const pages = Array.from({ length: pageCount }, (_, i) => ({
      project_id: project.id,
      sort_order: i + 1,
    }));
    await supabase.from("photobook_pages").insert(pages);

    redirect(`/fotolibro/${project.id}/portada`);
  });
}

export async function updateCoverAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const projectId = formData.get("project_id") as string;
    const title = (formData.get("title") as string) ?? "";
    const coverImagePath = formData.get("cover_image_path") as string;
    const cropRaw = formData.get("cover_crop") as string;

    if (!projectId) return { message: "Proyecto no encontrado." };

    const { supabase } = await requireUser();
    const crop: CropState = cropRaw ? JSON.parse(cropRaw) : { x: 0, y: 0, scale: 1 };

    const { error } = await supabase
      .from("photobook_projects")
      .update({
        title,
        cover_image_path: coverImagePath || null,
        cover_crop: crop as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (error) return { message: error.message };

    redirect(`/fotolibro/${projectId}/paginas`);
  });
}

export async function updatePageCropAction(
  projectId: string,
  pageId: string,
  crop: CropState,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("photobook_pages")
      .update({ crop: crop as unknown as Json })
      .eq("id", pageId);
    if (error) return { message: error.message };
    revalidatePath(`/fotolibro/${projectId}/paginas`);
    return {};
  });
}

export async function reorderPagesAction(
  projectId: string,
  orderedIds: string[],
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const updates = orderedIds.map((id, i) =>
      supabase
        .from("photobook_pages")
        .update({ sort_order: i + 1 })
        .eq("id", id)
        .eq("project_id", projectId),
    );
    await Promise.all(updates);
    revalidatePath(`/fotolibro/${projectId}/paginas`);
    return {};
  });
}

export async function assignImageToPageAction(
  projectId: string,
  pageId: string,
  imagePath: string,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("photobook_pages")
      .update({ image_path: imagePath })
      .eq("id", pageId);
    if (error) return { message: error.message };
    revalidatePath(`/fotolibro/${projectId}/paginas`);
    return {};
  });
}

export async function markProjectCompletedAction(
  projectId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("photobook_projects")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) return { message: error.message };
    return {};
  });
}
