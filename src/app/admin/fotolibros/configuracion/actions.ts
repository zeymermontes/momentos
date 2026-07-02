"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { runAction } from "@/lib/server-action";
import type { PhotobookSettings } from "@/lib/photobook-config";
import type { Json } from "@/lib/supabase/database.types";

type ActionState = { message?: string };

export async function updatePhotobookSettingsAction(
  settings: PhotobookSettings,
): Promise<ActionState> {
  return runAction(async () => {
    const { supabase } = await requireAdmin();

    if (settings.sizes.length === 0) return { message: "Agrega al menos un tamaño." };
    if (settings.page_counts.length === 0) return { message: "Agrega al menos una opción de páginas." };

    for (const s of settings.sizes) {
      if (s.cm <= 0) return { message: "El tamaño en cm debe ser mayor a 0." };
      if (!s.label.trim()) return { message: "Cada tamaño necesita una etiqueta." };
      if (s.supports_hardcover && s.hardcover_price < 0) {
        return { message: `El costo de pasta dura para "${s.label}" no puede ser negativo.` };
      }
      if (!s.prices || Object.keys(s.prices).length === 0) {
        return { message: `Define al menos un precio para el tamaño ${s.label}.` };
      }
      for (const [pc, price] of Object.entries(s.prices)) {
        if (Number(price) < 0) {
          return { message: `El precio de ${pc} páginas no puede ser negativo.` };
        }
      }
    }

    for (const c of settings.page_counts) {
      if (c <= 0) return { message: "Las opciones de páginas deben ser mayores a 0." };
    }

    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: "photobook", value: settings as unknown as Json, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) return { message: error.message };

    revalidatePath("/fotolibro");
    revalidatePath("/admin/fotolibros");
    return { message: "Configuración guardada." };
  });
}
