"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PhotobookSettings, PhotobookSize } from "@/lib/photobook-config";
import { updatePhotobookSettingsAction } from "../actions";

export function PhotobookSettingsForm({
  settings: initial,
}: {
  settings: PhotobookSettings;
}) {
  const [sizes, setSizes] = useState<PhotobookSize[]>(initial.sizes);
  const [pageCounts, setPageCounts] = useState<number[]>(initial.page_counts);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [newPageCount, setNewPageCount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function updateSize(
    index: number,
    field: keyof PhotobookSize,
    value: string | number | boolean,
  ) {
    setSizes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }

  function updateSizePrice(sizeIndex: number, pageCount: number, price: number) {
    setSizes((prev) =>
      prev.map((s, i) => {
        if (i !== sizeIndex) return s;
        const prices = { ...(s.prices ?? {}), [pageCount]: price };
        return { ...s, prices };
      }),
    );
  }

  function addSize() {
    setSizes((prev) => [
      ...prev,
      {
        cm: 25,
        label: "Nuevo",
        sublabel: "25 × 25 cm",
        supports_hardcover: true,
        hardcover_price: 150,
        prices: Object.fromEntries(pageCounts.map((c) => [c, c * 12])),
      },
    ]);
  }

  function removeSize(index: number) {
    setSizes((prev) => prev.filter((_, i) => i !== index));
  }

  function addPageCount() {
    const n = Number(newPageCount);
    if (n > 0 && !pageCounts.includes(n)) {
      setPageCounts((prev) => [...prev, n].sort((a, b) => a - b));
      // Seed a starting price for the new page count on every size, based on
      // the average price-per-page from existing entries of that size.
      setSizes((prev) =>
        prev.map((s) => {
          const entries = Object.entries(s.prices ?? {});
          const avgPerPage =
            entries.length > 0
              ? entries.reduce(
                  (acc, [pc, price]) => acc + Number(price) / Number(pc),
                  0,
                ) / entries.length
              : 10;
          return {
            ...s,
            prices: { ...(s.prices ?? {}), [n]: Math.round(avgPerPage * n) },
          };
        }),
      );
      setNewPageCount("");
    }
  }

  function removePageCount(count: number) {
    setPageCounts((prev) => prev.filter((c) => c !== count));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updatePhotobookSettingsAction({
        sizes,
        page_counts: pageCounts,
        enabled,
      });
      setMessage(result.message ?? "Guardado correctamente.");
      setTimeout(() => setMessage(null), 3000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Enabled toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Fotolibros habilitados
        </label>
        <span className="text-xs text-muted-foreground">
          {enabled ? "Los clientes pueden crear fotolibros" : "La sección de fotolibros está desactivada"}
        </span>
      </div>

      {/* Sizes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Tamaños</h4>
          <Button variant="outline" size="sm" onClick={addSize}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar tamaño
          </Button>
        </div>

        <div className="space-y-4">
          {sizes.map((size, i) => (
            <div
              key={i}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Tamaño {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeSize(i)}
                  className="text-destructive hover:text-destructive/80"
                  disabled={sizes.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Centímetros</Label>
                  <Input
                    type="number"
                    value={size.cm}
                    onChange={(e) => updateSize(i, "cm", Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div>
                  <Label>Etiqueta</Label>
                  <Input
                    value={size.label}
                    onChange={(e) => updateSize(i, "label", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Subtítulo</Label>
                  <Input
                    value={size.sublabel}
                    onChange={(e) => updateSize(i, "sublabel", e.target.value)}
                    placeholder="20 × 20 cm"
                  />
                </div>
                <div className="col-span-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={size.supports_hardcover !== false}
                      onChange={(e) =>
                        updateSize(i, "supports_hardcover", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    Este tamaño acepta pasta dura
                  </label>
                  {size.supports_hardcover !== false ? (
                    <div>
                      <Label>Costo pasta dura (MXN)</Label>
                      <Input
                        type="number"
                        value={size.hardcover_price}
                        onChange={(e) =>
                          updateSize(i, "hardcover_price", Number(e.target.value))
                        }
                        min={0}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Se suma al precio base cuando el cliente elige pasta dura.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      El cliente solo verá pasta blanda para este tamaño.
                    </p>
                  )}
                </div>
              </div>

              {/* Price matrix per page count */}
              <div className="space-y-2 border-t border-border pt-3">
                <Label>Precios por número de páginas (MXN)</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {pageCounts.map((count) => {
                    const value = size.prices?.[count] ?? 0;
                    return (
                      <div key={count} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {count} páginas
                        </Label>
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) =>
                            updateSizePrice(i, count, Number(e.target.value))
                          }
                          min={0}
                          step={0.5}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  El precio no es proporcional — define cuánto cuesta cada combinación.
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Page counts */}
      <section className="space-y-4">
        <h4 className="font-semibold">Opciones de páginas</h4>
        <div className="flex flex-wrap gap-2">
          {pageCounts.map((count) => (
            <div
              key={count}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm"
            >
              <span>{count} páginas</span>
              <button
                type="button"
                onClick={() => removePageCount(count)}
                className="text-muted-foreground hover:text-destructive"
                disabled={pageCounts.length <= 1}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            value={newPageCount}
            onChange={(e) => setNewPageCount(e.target.value)}
            placeholder="Ej: 80"
            className="w-32"
            min={1}
          />
          <Button variant="outline" size="sm" onClick={addPageCount} disabled={!newPageCount}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Para promociones de fotolibros (descuentos, compra X lleva Y), usa la sección de Promociones del admin.
        </p>
      </section>

      {/* Save */}
      {message && (
        <p className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-900">
          {message}
        </p>
      )}

      <Button onClick={handleSave} disabled={isPending} className="gap-2">
        <Save className="h-4 w-4" />
        {isPending ? "Guardando..." : "Guardar configuración"}
      </Button>
    </div>
  );
}
