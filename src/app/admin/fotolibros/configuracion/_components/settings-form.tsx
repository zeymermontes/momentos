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

  function updateSize(index: number, field: keyof PhotobookSize, value: string | number) {
    setSizes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }

  function addSize() {
    setSizes((prev) => [
      ...prev,
      { cm: 25, label: "Nuevo", sublabel: "25 × 25 cm", price_per_page: 12, hardcover_price: 150 },
    ]);
  }

  function removeSize(index: number) {
    setSizes((prev) => prev.filter((_, i) => i !== index));
  }

  function addPageCount() {
    const n = Number(newPageCount);
    if (n > 0 && !pageCounts.includes(n)) {
      setPageCounts((prev) => [...prev, n].sort((a, b) => a - b));
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
                <div>
                  <Label>Subtítulo</Label>
                  <Input
                    value={size.sublabel}
                    onChange={(e) => updateSize(i, "sublabel", e.target.value)}
                    placeholder="20 × 20 cm"
                  />
                </div>
                <div>
                  <Label>Precio por página (MXN)</Label>
                  <Input
                    type="number"
                    value={size.price_per_page}
                    onChange={(e) => updateSize(i, "price_per_page", Number(e.target.value))}
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <Label>Costo pasta dura (MXN)</Label>
                  <Input
                    type="number"
                    value={size.hardcover_price}
                    onChange={(e) => updateSize(i, "hardcover_price", Number(e.target.value))}
                    min={0}
                  />
                </div>
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
