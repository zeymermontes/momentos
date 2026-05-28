"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMXN } from "@/lib/utils";
import type { PhotobookSettings } from "@/lib/photobook-config";
import { getPhotobookPrice } from "@/lib/photobook-config";
import {
  createProjectAction,
  type ActionState,
} from "@/app/(storefront)/fotolibro/actions";

export function ConfigForm({ settings }: { settings: PhotobookSettings }) {
  const [sizeCm, setSizeCm] = useState(settings.sizes[0]?.cm ?? 20);
  const [pageCount, setPageCount] = useState(settings.page_counts[0] ?? 20);
  const [state, formAction, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(createProjectAction, undefined);

  const price = getPhotobookPrice(settings, sizeCm, pageCount);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="size_cm" value={sizeCm} />
      <input type="hidden" name="page_count" value={pageCount} />

      {/* Size selector */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Tamaño</legend>
        <div className="grid grid-cols-3 gap-3">
          {settings.sizes.map((s) => (
            <button
              key={s.cm}
              type="button"
              onClick={() => setSizeCm(s.cm)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition",
                sizeCm === s.cm
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div
                className="rounded-lg bg-muted"
                style={{ width: 16 + s.cm * 1.5, height: 16 + s.cm * 1.5 }}
              />
              <span className="font-semibold">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.sublabel}</span>
              <span className="text-xs text-primary font-medium">
                desde {formatMXN(Math.min(...Object.values(s.prices ?? { 0: 0 })))}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Page count selector */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Número de páginas</legend>
        <div className="grid grid-cols-3 gap-3">
          {settings.page_counts.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setPageCount(count)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 p-5 transition",
                pageCount === count
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="text-2xl font-bold">{count}</span>
              <span className="text-xs text-muted-foreground">páginas</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Price preview */}
      <div className="rounded-xl bg-muted/40 p-4 text-center">
        <span className="text-sm text-muted-foreground">Desde </span>
        <span className="text-2xl font-bold">{formatMXN(price)}</span>
        <span className="text-sm text-muted-foreground"> pasta blanda</span>
      </div>

      {state?.message && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full gap-2">
        {pending ? "Creando..." : "Comenzar"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
