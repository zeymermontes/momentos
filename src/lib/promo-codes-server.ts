import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PromoCode, PromoCodeValidation } from "@/lib/promo-codes";

export async function findPromoCode(code: string): Promise<PromoCode | null> {
  const cleaned = code.trim();
  if (!cleaned) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("promotions")
    .select(
      "id, code, label, description, discount_type, value, min_subtotal, starts_at, ends_at, usage_limit, times_used, active",
    )
    .ilike("code", cleaned)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    value: Number(data.value),
    min_subtotal:
      data.min_subtotal === null ? null : Number(data.min_subtotal),
  };
}

export async function validatePromoCode(
  code: string,
  cartSubtotal: number,
): Promise<PromoCodeValidation> {
  const promo = await findPromoCode(code);
  if (!promo) return { ok: false, message: "Código no válido." };
  if (!promo.active) {
    return { ok: false, message: "Este código ya no está activo." };
  }
  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) {
    return { ok: false, message: "Este código todavía no es válido." };
  }
  if (promo.ends_at && new Date(promo.ends_at) <= now) {
    return { ok: false, message: "Este código ya venció." };
  }
  if (
    promo.usage_limit !== null &&
    promo.times_used >= promo.usage_limit
  ) {
    return { ok: false, message: "Este código alcanzó su límite de uso." };
  }
  if (promo.min_subtotal !== null && cartSubtotal < promo.min_subtotal) {
    return {
      ok: false,
      message: `Tu carrito necesita al menos $${promo.min_subtotal.toFixed(2)} para usar este código.`,
    };
  }
  return { ok: true, promo };
}

export async function incrementCodeUsage(promoId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("promotions")
      .select("times_used")
      .eq("id", promoId)
      .maybeSingle();
    if (!row) return;
    await admin
      .from("promotions")
      .update({ times_used: Number(row.times_used) + 1 })
      .eq("id", promoId);
  } catch (e) {
    console.error("[promo-codes] failed to increment times_used:", e);
  }
}
