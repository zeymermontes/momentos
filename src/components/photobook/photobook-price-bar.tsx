"use client";

import { formatMXN } from "@/lib/utils";
import {
  previewItemDiscount,
  type PromotionRule,
} from "@/lib/promotions-engine";
import { PromoTicker } from "@/components/photobook/promo-ticker";

/**
 * The price summary under the size / page-count pickers.
 *
 * Promotions are evaluated on the cart, so until now the builder quoted the
 * list price and the customer only discovered a fotolibros promo after adding
 * to cart. This surfaces it at the moment they're choosing, for the exact
 * (size, pages) combination selected — the only point in this screen where
 * both are pinned down and the number is therefore exact.
 */
export function PhotobookPriceBar({
  price,
  sizeCm,
  pageCount,
  promotionRules,
}: {
  price: number;
  sizeCm: number;
  pageCount: number;
  promotionRules?: PromotionRule[];
}) {
  const promo = promotionRules?.length
    ? previewItemDiscount(promotionRules, {
        product_id: "",
        category_id: null,
        quantity: 1,
        unit_price: price,
        is_photobook: true,
        photobook_size_cm: sizeCm,
        photobook_page_count: pageCount,
      })
    : null;

  return (
    <div className="rounded-xl bg-muted/40 p-4 text-center">
      {promo ? (
        <>
          <div className="flex flex-wrap items-baseline justify-center gap-x-2">
            <span className="text-sm text-muted-foreground line-through">
              {formatMXN(price)}
            </span>
            <span className="text-2xl font-bold text-primary">
              {formatMXN(promo.finalPrice)}
            </span>
            <span className="text-sm text-muted-foreground">pasta blanda</span>
          </div>
          <PromoTicker promos={promo.promos} />
        </>
      ) : (
        <>
          <span className="text-sm text-muted-foreground">Desde </span>
          <span className="text-2xl font-bold">{formatMXN(price)}</span>
          <span className="text-sm text-muted-foreground"> pasta blanda</span>
        </>
      )}
    </div>
  );
}
