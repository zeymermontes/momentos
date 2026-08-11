import { createClient } from "@/lib/supabase/server";
import type { PromotionRule } from "@/lib/promotions-engine";

export type { PromotionRule };
export {
  evaluatePromotions,
  snapshotApplied,
  readSizeCm,
  PROMOTION_TYPE_LABEL,
  PROMOTION_SCOPE_LABEL,
  type CartItemForPromo,
  type EvaluatedPromotion,
  type CartPromotionsResult,
  type AppliedPromotionSnapshot,
} from "@/lib/promotions-engine";

export async function getActivePromotionRules(): Promise<PromotionRule[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: rules } = await supabase
    .from("promotion_rules")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const live = (rules ?? []).filter((r) => {
    if (r.starts_at && r.starts_at > nowIso) return false;
    if (r.ends_at && r.ends_at <= nowIso) return false;
    return true;
  });
  if (live.length === 0) return [];

  const ruleIds = live.map((r) => r.id);
  const [{ data: prods }, { data: cats }] = await Promise.all([
    supabase
      .from("promotion_rule_products")
      .select("promotion_rule_id, product_id")
      .in("promotion_rule_id", ruleIds),
    supabase
      .from("promotion_rule_categories")
      .select("promotion_rule_id, category_id")
      .in("promotion_rule_id", ruleIds),
  ]);

  const productsByRule = new Map<string, string[]>();
  for (const row of prods ?? []) {
    const arr = productsByRule.get(row.promotion_rule_id) ?? [];
    arr.push(row.product_id);
    productsByRule.set(row.promotion_rule_id, arr);
  }
  const catsByRule = new Map<string, string[]>();
  for (const row of cats ?? []) {
    const arr = catsByRule.get(row.promotion_rule_id) ?? [];
    arr.push(row.category_id);
    catsByRule.set(row.promotion_rule_id, arr);
  }

  return live.map((r) => ({
    ...r,
    discount_value: Number(r.discount_value),
    buy_x: r.buy_x === null || r.buy_x === undefined ? null : Number(r.buy_x),
    min_subtotal: r.min_subtotal === null ? null : Number(r.min_subtotal),
    photobook_size_cm: (r.photobook_size_cm ?? []).map(Number),
    product_ids: productsByRule.get(r.id) ?? [],
    category_ids: catsByRule.get(r.id) ?? [],
  }));
}
