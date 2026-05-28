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

    const { data: existing } = await supabase
      .from("photobook_projects")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["draft", "completed"])
      .limit(1)
      .maybeSingle();
    if (existing) redirect(`/fotolibro/${existing.id}/configuracion`);

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

    redirect(`/fotolibro/${project.id}/configuracion`);
  });
}

export async function updateProjectConfigAction(
  projectId: string,
  sizeCm: number,
  pageCount: number,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireUser();

    const { data: project } = await supabase
      .from("photobook_projects")
      .select("size_cm, page_count")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return { message: "Proyecto no encontrado." };

    const sizeChanged = sizeCm !== project.size_cm;
    const pageCountChanged = pageCount !== project.page_count;
    if (!sizeChanged && !pageCountChanged) return {};

    await supabase
      .from("photobook_projects")
      .update({
        size_cm: sizeCm,
        page_count: pageCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (pageCountChanged) {
      if (pageCount > project.page_count) {
        const newPages = Array.from(
          { length: pageCount - project.page_count },
          (_, i) => ({
            project_id: projectId,
            sort_order: project.page_count + i + 1,
          }),
        );
        await supabase.from("photobook_pages").insert(newPages);
      } else {
        const { data: allPages } = await supabase
          .from("photobook_pages")
          .select("id")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: false })
          .limit(project.page_count - pageCount);
        if (allPages && allPages.length > 0) {
          await supabase
            .from("photobook_pages")
            .delete()
            .in("id", allPages.map((p) => p.id));
        }
      }
    }

    if (sizeChanged) {
      await supabase
        .from("photobook_pages")
        .update({ crop: { x: 0, y: 0, scale: 1, rotation: 0 } })
        .eq("project_id", projectId);
    }

    revalidatePath(`/fotolibro/${projectId}/configuracion`);
    return {};
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
    const coverThumbPath = formData.get("cover_thumb_path") as string;
    const cropRaw = formData.get("cover_crop") as string;

    if (!projectId) return { message: "Proyecto no encontrado." };

    const { supabase } = await requireUser();
    const crop: CropState = cropRaw ? JSON.parse(cropRaw) : { x: 0, y: 0, scale: 1 };

    const { error } = await supabase
      .from("photobook_projects")
      .update({
        title,
        cover_image_path: coverImagePath || null,
        cover_thumb_path: coverThumbPath || null,
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
    // Move all rows to temporary negative sort_orders first to avoid
    // the unique(project_id, sort_order) constraint during the swap.
    const tempUpdates = orderedIds.map((id, i) =>
      supabase
        .from("photobook_pages")
        .update({ sort_order: -(i + 1) })
        .eq("id", id)
        .eq("project_id", projectId),
    );
    await Promise.all(tempUpdates);

    const finalUpdates = orderedIds.map((id, i) =>
      supabase
        .from("photobook_pages")
        .update({ sort_order: i + 1 })
        .eq("id", id)
        .eq("project_id", projectId),
    );
    await Promise.all(finalUpdates);

    revalidatePath(`/fotolibro/${projectId}/paginas`);
    return {};
  });
}

export async function assignImageToPageAction(
  projectId: string,
  pageId: string,
  imagePath: string,
  thumbPath?: string,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("photobook_pages")
      .update({ image_path: imagePath, thumb_path: thumbPath ?? null })
      .eq("id", pageId);
    if (error) return { message: error.message };
    revalidatePath(`/fotolibro/${projectId}/paginas`);
    return {};
  });
}

export async function clearPageImageAction(
  projectId: string,
  pageId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("photobook_pages")
      .update({ image_path: null, thumb_path: null, crop: { x: 0, y: 0, scale: 1 } })
      .eq("id", pageId);
    if (error) return { message: error.message };
    revalidatePath(`/fotolibro/${projectId}/paginas`);
    return {};
  });
}

export async function changePageCountAction(
  projectId: string,
  newPageCount: number,
): Promise<ActionState & { newPages?: { id: string; sort_order: number }[]; removedIds?: string[] }> {
  return runAction(async () => {
    if (![20, 40, 60].includes(newPageCount)) return { message: "Opción inválida." };

    const { supabase } = await requireUser();
    const { data: project } = await supabase
      .from("photobook_projects")
      .select("page_count")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return { message: "Proyecto no encontrado." };
    if (newPageCount === project.page_count) return { message: "Ya tienes ese número de páginas." };

    await supabase
      .from("photobook_projects")
      .update({ page_count: newPageCount, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (newPageCount > project.page_count) {
      const newPages = Array.from(
        { length: newPageCount - project.page_count },
        (_, i) => ({
          project_id: projectId,
          sort_order: project.page_count + i + 1,
        }),
      );
      const { data: inserted } = await supabase
        .from("photobook_pages")
        .insert(newPages)
        .select("id, sort_order");

      revalidatePath(`/fotolibro/${projectId}/paginas`);
      return { newPages: inserted ?? [] };
    }

    // Downgrade: delete empty pages from the end first, then filled pages if needed.
    const { data: allPages } = await supabase
      .from("photobook_pages")
      .select("id, sort_order, image_path")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false });

    const toRemove = (allPages ?? []).slice(0, project.page_count - newPageCount);
    const removeIds = toRemove.map((p) => p.id);

    if (removeIds.length > 0) {
      await supabase
        .from("photobook_pages")
        .delete()
        .in("id", removeIds);
    }

    revalidatePath(`/fotolibro/${projectId}/paginas`);
    return { removedIds: removeIds };
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

export async function addPhotobookToCartAction(
  projectId: string,
  hardcover = false,
  quantity = 1,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase, user } = await requireUser();
    const qty = Math.max(1, Math.min(99, Math.round(quantity)));

    const { data: project } = await supabase
      .from("photobook_projects")
      .select("id, size_cm, page_count, title, cover_thumb_path, user_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return { message: "Proyecto no encontrado." };
    if (project.user_id !== user.id) return { message: "No autorizado." };

    const { data: filledPages } = await supabase
      .from("photobook_pages")
      .select("id")
      .eq("project_id", projectId)
      .not("image_path", "is", null);
    if (!filledPages || filledPages.length === 0) {
      return { message: "Agrega al menos una foto a tu fotolibro." };
    }

    await supabase
      .from("photobook_projects")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    const { getPhotobookSettings } = await import("@/lib/photobook");
    const { getPhotobookPrice } = await import("@/lib/photobook-config");
    const settings = await getPhotobookSettings();
    const unitPrice = getPhotobookPrice(settings, project.size_cm, project.page_count, hardcover);

    const { getOrCreateCart } = await import("@/lib/cart");
    const cart = await getOrCreateCart();

    const { data: existing } = await supabase
      .from("cart_items")
      .select("id")
      .eq("cart_id", cart.cartId)
      .eq("customization->>photobook_project_id", projectId)
      .maybeSingle();
    if (existing) return { message: "Este fotolibro ya está en tu carrito." };

    let coverPreviewUrl: string | null = null;
    if (project.cover_thumb_path) {
      const { data: signed } = await supabase.storage
        .from("customer-uploads")
        .createSignedUrl(project.cover_thumb_path, 86400);
      coverPreviewUrl = signed?.signedUrl ?? null;
    }

    const { error } = await supabase.from("cart_items").insert({
      cart_id: cart.cartId,
      product_id: null,
      unit_price: unitPrice,
      quantity: qty,
      customization: {
        type: "photobook",
        photobook_project_id: projectId,
        title: project.title || "Fotolibro",
        size_cm: project.size_cm,
        page_count: project.page_count,
        filled_pages: filledPages.length,
        hardcover,
      },
      preview_url: coverPreviewUrl,
    });
    if (error) return { message: error.message };

    revalidatePath("/carrito");
    redirect("/carrito");
  });
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase, user } = await requireUser();

    const { data: project } = await supabase
      .from("photobook_projects")
      .select("id, user_id, cover_image_path, cover_thumb_path")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return { message: "Proyecto no encontrado." };
    if (project.user_id !== user.id) return { message: "No autorizado." };

    // Collect all storage paths to delete
    const paths: string[] = [];
    if (project.cover_image_path) paths.push(project.cover_image_path);
    if (project.cover_thumb_path) paths.push(project.cover_thumb_path);

    const { data: pages } = await supabase
      .from("photobook_pages")
      .select("image_path, thumb_path")
      .eq("project_id", projectId);
    for (const p of pages ?? []) {
      if (p.image_path) paths.push(p.image_path);
      if (p.thumb_path) paths.push(p.thumb_path);
    }

    // Delete files from storage
    if (paths.length > 0) {
      await supabase.storage.from("customer-uploads").remove(paths);
    }

    // Delete project (cascade deletes pages)
    const { error } = await supabase
      .from("photobook_projects")
      .delete()
      .eq("id", projectId);
    if (error) return { message: error.message };

    redirect("/fotolibro");
  });
}

export async function savePrintSheetsAction(
  projectId: string,
  sheetPaths: { side: "front" | "back" | "cover"; index: number; path: string }[],
): Promise<ActionState> {
  return runAction(async () => {
    const { requireAdmin } = await import("@/lib/auth");
    const { supabase } = await requireAdmin();

    // Read existing sheets so we can delete any that aren't in the new set.
    const { data: existing } = await supabase
      .from("photobook_projects")
      .select("print_sheets")
      .eq("id", projectId)
      .maybeSingle();

    const oldPaths: string[] = Array.isArray(existing?.print_sheets)
      ? (existing!.print_sheets as { path?: string }[])
          .map((s) => s?.path)
          .filter((p): p is string => Boolean(p))
      : [];
    const newPathsSet = new Set(sheetPaths.map((s) => s.path));
    const toDelete = oldPaths.filter((p) => !newPathsSet.has(p));

    const { error } = await supabase
      .from("photobook_projects")
      .update({
        print_sheets: sheetPaths as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (error) return { message: error.message };

    if (toDelete.length > 0) {
      await supabase.storage.from("customer-uploads").remove(toDelete);
    }

    revalidatePath(`/admin/fotolibros/${projectId}`);
    return {};
  });
}
