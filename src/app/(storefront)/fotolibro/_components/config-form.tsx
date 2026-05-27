"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SIZES, PAGE_COUNTS } from "@/lib/photobook";
import {
  createProjectAction,
  type ActionState,
} from "@/app/(storefront)/fotolibro/actions";
import { useState } from "react";

export function ConfigForm() {
  const [sizeCm, setSizeCm] = useState(20);
  const [pageCount, setPageCount] = useState(20);
  const [state, formAction, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(createProjectAction, undefined);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="size_cm" value={sizeCm} />
      <input type="hidden" name="page_count" value={pageCount} />

      {/* Size selector */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Tamaño</legend>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => (
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
                className={cn(
                  "rounded-lg bg-muted",
                  s.cm === 15 && "h-12 w-12",
                  s.cm === 20 && "h-16 w-16",
                  s.cm === 30 && "h-20 w-20",
                )}
              />
              <span className="font-semibold">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.sublabel}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Page count selector */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Número de páginas</legend>
        <div className="grid grid-cols-3 gap-3">
          {PAGE_COUNTS.map((count) => (
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
