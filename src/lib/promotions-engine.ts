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
  /**
   * For `scope = "fotolibros"`: the photobook sizes (in cm) the promo applies
   * to. Empty means every size qualifies — that's the behaviour of every rule
   * created before per-size targeting existed.
   */
  photobook_size_cm: number[];
  /**
   * For `scope = "fotolibros"`: the page counts the promo applies to. Empty
   * means all. ANDed with `photobook_size_cm`, because price depends on the
   * pair — a 16×16 is $300 at 60 pages and $400 at 100.
   */
  photobook_page_count: number[];
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
  /** Size of the photobook in cm. Only set when `is_photobook`. */
  photobook_size_cm?: number | null;
  /** Page count of the photobook. Only set when `is_photobook`. */
  photobook_page_count?: number | null;
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

/**
 * Pull the photobook size out of a cart item's `customization` blob. It is
 * written by the fotolibro flow as a number, but jsonb round-trips loosely
 * enough that a numeric string shows up too.
 */
export function readSizeCm(
  customization: Record<string, unknown> | null | undefined,
): number | null {
  const raw = customization?.size_cm;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Companion to {@link readSizeCm} for the page count. */
export function readPageCount(
  customization: Record<string, unknown> | null | undefined,
): number | null {
  const raw = customization?.page_count;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * One axis of the fotolibros scope (size or page count). An empty allow-list
 * means "no restriction on this axis"; otherwise the item must carry a value
 * and that value must be listed.
 */
function matchesDimension(
  allowed: number[] | undefined,
  value: number | null | undefined,
): boolean {
  if (!allowed || allowed.length === 0) return true;
  return value != null && allowed.includes(Number(value));
}

/** Does this cart line fall inside the rule's scope? */
function itemInScope(rule: PromotionRule, item: CartItemForPromo): boolean {
  if (rule.scope === "all") return true;

  if (rule.scope === "fotolibros") {
    if (!item.is_photobook) return false;
    // Each list empty = that dimension is unrestricted. Both restricted means
    // the item has to match on both, since price is set per (size, pages).
    return (
      matchesDimension(rule.photobook_size_cm, item.photobook_size_cm) &&
      matchesDimension(rule.photobook_page_count, item.photobook_page_count)
    );
  }

  if (rule.scope === "products") {
    return rule.product_ids.includes(item.product_id);
  }

  // scope === "categories"
  const cats = [
    item.category_id,
    ...(item.additional_category_ids ?? []),
  ].filter((x): x is string => Boolean(x));
  return cats.some((c) => rule.category_ids.includes(c));
}

function qualifyingSubtotal(
  rule: PromotionRule,
  items: CartItemForPromo[],
): number {
  return items
    .filter((i) => itemInScope(rule, i))
    .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
}

function qualifyingQuantity(
  rule: PromotionRule,
  items: CartItemForPromo[],
): number {
  return items
    .filter((i) => itemInScope(rule, i))
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

export type SingleItemDiscount = {
  /** Each promo that fired, with what it takes off this one unit. */
  promos: Array<{ label: string; amount: number }>;
  /** Total pesos off this one unit. */
  amount: number;
  finalPrice: number;
};

/**
 * What one unit of a product would cost on its own, given the active promos.
 *
 * The photobook builder shows a price before anything reaches the cart, so it
 * needs an answer for a single configured book. Only promos whose discount is
 * knowable from that one item are counted: `free_shipping` isn't an item price
 * at all, and `buy_x_get_y` (like any quantity gate) depends on what else the
 * customer ends up buying. Quantity-gated rules drop out on their own, since
 * this evaluates a cart of exactly one unit.
 *
 * Understating is the safe direction here — a rule with a minimum this single
 * item doesn't reach simply won't show, and the cart may then beat the quoted
 * price. Overstating would be the bug.
 *
 * Returns null when nothing applies, so callers can render the plain price.
 */
export function previewSingleItemDiscount(
  rules: PromotionRule[],
  item: CartItemForPromo,
): SingleItemDiscount | null {
  const unit = { ...item, quantity: 1 };
  const { applied } = evaluatePromotions(rules, [unit], 0);

  const itemLevel = applied.filter(
    (a) => a.rule.type === "percent_off" || a.rule.type === "amount_off",
  );
  if (itemLevel.length === 0) return null;

  const amount = round2(
    Math.min(
      itemLevel.reduce((s, a) => s + a.discount_amount, 0),
      Number(unit.unit_price),
    ),
  );
  if (amount <= 0) return null;

  return {
    promos: itemLevel.map((a) => ({
      label: a.rule.label,
      amount: round2(a.discount_amount),
    })),
    amount,
    finalPrice: round2(Number(unit.unit_price) - amount),
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
