"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMXN } from "@/lib/utils";
import { getPhotobookPrice } from "@/lib/photobook-config";
import type { PhotobookSettings } from "@/lib/photobook-config";
import { updateProjectConfigAction } from "@/app/(storefront)/fotolibro/actions";

type Props = {
  projectId: string;
  currentSizeCm: number;
  currentPageCount: number;
  settings: PhotobookSettings;
};

export function ProjectConfigForm({
  projectId,
  currentSizeCm,
  currentPageCount,
  settings,
}: Props) {
  const router = useRouter();
  const [sizeCm, setSizeCm] = useState(currentSizeCm);
  const [pageCount, setPageCount] = useState(currentPageCount);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const changed = sizeCm !== currentSizeCm || pageCount !== currentPageCount;
  const price = getPhotobookPrice(settings, sizeCm, pageCount);

  function handleContinue() {
    if (!changed) {
      router.push(`/fotolibro/${projectId}/portada`);
      return;
    }

    startTransition(async () => {
      const result = await updateProjectConfigAction(projectId, sizeCm, pageCount);
      if (result.message) {
        setError(result.message);
        return;
      }
      router.push(`/fotolibro/${projectId}/portada`);
    });
  }

  return (
    <div className="space-y-8">
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

      {changed && sizeCm !== currentSizeCm && (
        <p className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          Cambiar el tamaño reiniciará el ajuste de tus fotos en las páginas.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleContinue}
        disabled={isPending}
      >
        {isPending ? "Guardando..." : changed ? "Guardar y continuar" : "Continuar"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
