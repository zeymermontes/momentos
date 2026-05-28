import type {
  PromotionRuleType,
  PromotionRuleScope,
} from "@/lib/supabase/database.types";

export type PromotionRule = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  type: PromotionRuleType;
  discount_value: number;
  buy_x: number | null;
  min_subtotal: number | null;
  scope: PromotionRuleScope;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  active: boolean;
  product_ids: string[];
  category_ids: string[];
};

export type CartItemForPromo = {
  product_id: string;
  category_id: string | null;
  additional_category_ids?: string[];
  quantity: number;
  unit_price: number;
  is_photobook?: boolean;
};

export type EvaluatedPromotion = {
  rule: PromotionRule;
  qualified: boolean;
  discount_amount: number;
  free_shipping: boolean;
  missing_to_qualify?: number;
  /** "amount" = pesos, "quantity" = units */
  missing_type?: "amount" | "quantity";
};

export type CartPromotionsResult = {
  applied: EvaluatedPromotion[];
  almost: EvaluatedPromotion[];
  total_discount: number;
  free_shipping: boolean;
};

export type AppliedPromotionSnapshot = {
  rule_id: string;
  label: string;
  type: PromotionRuleType;
  discount_amount: number;
  code?: string;
};

function qualifyingSubtotal(
  rule: PromotionRule,
  items: CartItemForPromo[],
): number {
  if (rule.scope === "all") {
    return items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  }
  if (rule.scope === "fotolibros") {
    return items
      .filter((i) => i.is_photobook)
      .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  }
  if (rule.scope === "products") {
    return items
      .filter((i) => rule.product_ids.includes(i.product_id))
      .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  }
  // scope === "categories"
  return items
    .filter((i) => {
      const cats = [
        i.category_id,
        ...(i.additional_category_ids ?? []),
      ].filter((x): x is string => Boolean(x));
      return cats.some((c) => rule.category_ids.includes(c));
    })
    .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
}

function qualifyingQuantity(
  rule: PromotionRule,
  items: CartItemForPromo[],
): number {
  if (rule.scope === "all") {
    return items.reduce((s, i) => s + Number(i.quantity), 0);
  }
  if (rule.scope === "fotolibros") {
    return items.filter((i) => i.is_photobook).reduce((s, i) => s + Number(i.quantity), 0);
  }
  if (rule.scope === "products") {
    return items
      .filter((i) => rule.product_ids.includes(i.product_id))
      .reduce((s, i) => s + Number(i.quantity), 0);
  }
  return items
    .filter((i) => {
      const cats = [i.category_id, ...(i.additional_category_ids ?? [])].filter(
        (x): x is string => Boolean(x),
      );
      return cats.some((c) => rule.category_ids.includes(c));
    })
    .reduce((s, i) => s + Number(i.quantity), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function evaluatePromotions(
  rules: PromotionRule[],
  items: CartItemForPromo[],
  shippingCost: number,
): CartPromotionsResult {
  const cartSubtotal = items.reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.quantity),
    0,
  );

  const applied: EvaluatedPromotion[] = [];
  const almost: EvaluatedPromotion[] = [];
  let total = 0;
  let freeShipping = false;

  for (const rule of rules) {
    const min = rule.min_subtotal ?? 0;
    if (cartSubtotal < min) {
      const missing = min - cartSubtotal;
      if (missing <= Math.max(cartSubtotal, 100) * 2 || cartSubtotal > 0) {
        almost.push({
          rule,
          qualified: false,
          discount_amount: 0,
          free_shipping: false,
          missing_to_qualify: missing,
          missing_type: "amount",
        });
      }
      continue;
    }

    const qualSubtotal = qualifyingSubtotal(rule, items);
    const qualQty = qualifyingQuantity(rule, items);

    // Quantity gate: if buy_x is set, the qualifying quantity must meet it
    const minQty = rule.buy_x ?? 0;
    if (minQty > 0 && qualQty < minQty) {
      const missingQty = minQty - qualQty;
      if (qualQty > 0) {
        almost.push({
          rule,
          qualified: false,
          discount_amount: 0,
          free_shipping: false,
          missing_to_qualify: missingQty,
          missing_type: "quantity",
        });
      }
      continue;
    }

    if (qualSubtotal <= 0 && rule.type !== "free_shipping" && rule.type !== "buy_x_get_y") continue;

    let discount = 0;
    let makesFreeShipping = false;
    if (rule.type === "free_shipping") {
      makesFreeShipping = true;
      discount = shippingCost;
    } else if (rule.type === "percent_off") {
      discount = round2(qualSubtotal * (rule.discount_value / 100));
    } else if (rule.type === "amount_off") {
      discount = Math.min(rule.discount_value, qualSubtotal);
    } else if (rule.type === "buy_x_get_y") {
      const buyX = rule.buy_x ?? 2;
      const getY = Math.round(rule.discount_value);
      if (qualQty >= buyX) {
        const freeUnits = Math.floor(qualQty / buyX) * getY;
        const cappedFree = Math.min(freeUnits, qualQty - 1);
        const avgPrice = qualQty > 0 ? qualSubtotal / qualQty : 0;
        discount = round2(cappedFree * avgPrice);
      }
    }

    applied.push({
      rule,
      qualified: true,
      discount_amount: discount,
      free_shipping: makesFreeShipping,
    });
    total += discount;
    if (makesFreeShipping) freeShipping = true;
  }

  return {
    applied,
    almost,
    total_discount: round2(total),
    free_shipping: freeShipping,
  };
}

export function snapshotApplied(
  applied: EvaluatedPromotion[],
): AppliedPromotionSnapshot[] {
  return applied.map((a) => ({
    rule_id: a.rule.id,
    label: a.rule.label,
    type: a.rule.type,
    discount_amount: a.discount_amount,
  }));
}

export const PROMOTION_TYPE_LABEL: Record<PromotionRuleType, string> = {
  free_shipping: "Envío gratis",
  percent_off: "% de descuento",
  amount_off: "Descuento fijo",
  buy_x_get_y: "Compra X lleva Y",
};

export const PROMOTION_SCOPE_LABEL: Record<PromotionRuleScope, string> = {
  all: "Todo el carrito",
  products: "Productos específicos",
  categories: "Categorías específicas",
  fotolibros: "Fotolibros",
};
