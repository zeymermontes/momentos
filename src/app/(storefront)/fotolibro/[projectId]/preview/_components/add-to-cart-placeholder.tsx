"use client";

import { useState, useTransition } from "react";
import { ShoppingCart, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addPhotobookToCartAction } from "@/app/(storefront)/fotolibro/actions";
import { getPhotobookPrice } from "@/lib/photobook-config";
import type { PhotobookSettings } from "@/lib/photobook-config";
import { formatMXN, cn } from "@/lib/utils";

export function AddToCartButton({
  projectId,
  sizeCm,
  pageCount,
  settings,
}: {
  projectId: string;
  sizeCm: number;
  pageCount: number;
  settings: PhotobookSettings;
}) {
  const sizeConfig = settings.sizes.find((s) => s.cm === sizeCm);
  const supportsHardcover = sizeConfig?.supports_hardcover !== false;
  const hardcoverExtra = sizeConfig?.hardcover_price ?? 100;

  // When the size doesn't offer pasta dura, force `hardcover` to false so
  // the price calc, cart payload, and later admin views all agree — the
  // client-side picker is hidden but the state has to stay in sync in
  // case a config toggle happens mid-session.
  const [hardcover, setHardcover] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();

  const effectiveHardcover = supportsHardcover && hardcover;
  const unitPrice = getPhotobookPrice(
    settings,
    sizeCm,
    pageCount,
    effectiveHardcover,
  );
  const total = unitPrice * quantity;

  function handleClick() {
    startTransition(async () => {
      const result = await addPhotobookToCartAction(
        projectId,
        effectiveHardcover,
        quantity,
      );
      if (result?.message) {
        alert(result.message);
      }
    });
  }

  return (
    <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5">
      {/* Cover type — only rendered when the admin marked this size as
          supporting hardcover. Otherwise pasta blanda is the only option
          and there's no picker to show. */}
      {supportsHardcover ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Tipo de portada</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setHardcover(false)}
              className={cn(
                "rounded-lg border-2 p-3 text-sm transition",
                !hardcover
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="font-semibold">Pasta blanda</span>
              <span className="block text-xs text-muted-foreground">Incluida</span>
            </button>
            <button
              type="button"
              onClick={() => setHardcover(true)}
              className={cn(
                "rounded-lg border-2 p-3 text-sm transition",
                hardcover
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="font-semibold">Pasta dura</span>
              <span className="block text-xs text-muted-foreground">
                +{formatMXN(hardcoverExtra)}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Quantity */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Copias</p>
        <div className="inline-flex items-center rounded-md border border-border">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center hover:bg-muted disabled:opacity-50"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{quantity}</span>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center hover:bg-muted"
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="space-y-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Fotolibro {sizeCm}×{sizeCm} cm · {pageCount} pág.</span>
          <span>{formatMXN(getPhotobookPrice(settings, sizeCm, pageCount, false))}</span>
        </div>
        {effectiveHardcover && (
          <div className="flex justify-between text-muted-foreground">
            <span>Pasta dura</span>
            <span>+{formatMXN(hardcoverExtra)}</span>
          </div>
        )}
        {quantity > 1 && (
          <div className="flex justify-between text-muted-foreground">
            <span>× {quantity} copias</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-base pt-1">
          <span>Total</span>
          <span>{formatMXN(total)}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Las promociones se aplican en el carrito.
        </p>
      </div>

      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="h-4 w-4" />
        )}
        Agregar al carrito
      </Button>
    </div>
  );
}
