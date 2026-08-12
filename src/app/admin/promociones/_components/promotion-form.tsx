"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createPromotionAction,
  updatePromotionAction,
  type PromotionActionState,
} from "@/app/admin/promociones/actions";
import { cn } from "@/lib/utils";

type PromotionRule = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  type: "free_shipping" | "percent_off" | "amount_off" | "buy_x_get_y";
  buy_x: number | null;
  discount_value: number;
  min_subtotal: number | null;
  scope: "all" | "products" | "categories" | "fotolibros";
  photobook_size_cm: number[] | null;
  photobook_page_count: number[] | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  active: boolean;
};

type IdName = { id: string; name: string };

/** A photobook size as configured in Ajustes → Fotolibros. */
type SizeOption = { cm: number; label: string; sublabel: string };

type Props = {
  rule?: PromotionRule;
  selectedProductIds?: string[];
  selectedCategoryIds?: string[];
  products: IdName[];
  categories: IdName[];
  photobookSizes?: SizeOption[];
  photobookPageCounts?: number[];
};

export function PromotionForm({
  rule,
  selectedProductIds = [],
  selectedCategoryIds = [],
  products,
  categories,
  photobookSizes = [],
  photobookPageCounts = [],
}: Props) {
  const action = rule
    ? updatePromotionAction.bind(null, rule.id)
    : createPromotionAction;
  const [state, formAction] = useActionState<
    PromotionActionState | undefined,
    FormData
  >(action, undefined);

  const [type, setType] = useState<PromotionRule["type"]>(
    rule?.type ?? "free_shipping",
  );
  const [scope, setScope] = useState<PromotionRule["scope"]>(
    rule?.scope ?? "all",
  );
  const [productSet, setProductSet] = useState<Set<string>>(
    new Set(selectedProductIds),
  );
  const [categorySet, setCategorySet] = useState<Set<string>>(
    new Set(selectedCategoryIds),
  );
  // Stored as strings so they can share `toggle()` with the other pickers.
  const [sizeSet, setSizeSet] = useState<Set<string>>(
    new Set((rule?.photobook_size_cm ?? []).map(String)),
  );
  const [pageSet, setPageSet] = useState<Set<string>>(
    new Set((rule?.photobook_page_count ?? []).map(String)),
  );

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Nombre interno</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={rule?.name ?? ""}
            placeholder="Ej. Envío gratis verano 2026"
          />
          {state?.errors?.name?.[0] ? (
            <p className="text-xs text-destructive">{state.errors.name[0]}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="label">Etiqueta visible al cliente</Label>
          <Input
            id="label"
            name="label"
            required
            defaultValue={rule?.label ?? ""}
            placeholder="Ej. ¡Envío gratis al superar $500!"
          />
          {state?.errors?.label?.[0] ? (
            <p className="text-xs text-destructive">{state.errors.label[0]}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="description">Descripción interna (opcional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={rule?.description ?? ""}
          placeholder="Notas para el equipo"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="type">Tipo</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as PromotionRule["type"])}
          >
            <option value="free_shipping">Envío gratis</option>
            <option value="percent_off">% de descuento</option>
            <option value="amount_off">Descuento fijo ($)</option>
            <option value="buy_x_get_y">Compra X lleva Y gratis</option>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="discount_value">
            {type === "free_shipping"
              ? "Valor (no aplica)"
              : type === "percent_off"
                ? "Porcentaje (0-100)"
                : type === "amount_off"
                  ? "Monto ($)"
                  : "Unidades gratis (Y)"}
          </Label>
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            step={type === "percent_off" || type === "buy_x_get_y" ? "1" : "0.01"}
            min={type === "buy_x_get_y" ? "1" : "0"}
            max={type === "percent_off" ? "100" : undefined}
            defaultValue={rule?.discount_value ?? 0}
            disabled={type === "free_shipping"}
          />
          {state?.errors?.discount_value?.[0] ? (
            <p className="text-xs text-destructive">
              {state.errors.discount_value[0]}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="min_subtotal">Mínimo de compra ($)</Label>
          <Input
            id="min_subtotal"
            name="min_subtotal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={rule?.min_subtotal ?? ""}
            placeholder="Sin mínimo"
          />
        </div>
      </div>

      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor="buy_x">
          {type === "buy_x_get_y"
            ? "Compra mínima (X unidades)"
            : "Cantidad mínima de unidades"}
        </Label>
        <Input
          id="buy_x"
          name="buy_x"
          type="number"
          step="1"
          min={type === "buy_x_get_y" ? "2" : "0"}
          defaultValue={rule?.buy_x ?? ""}
          placeholder={type === "buy_x_get_y" ? "Ej. 3" : "Sin mínimo"}
          required={type === "buy_x_get_y"}
        />
        {state?.errors?.buy_x?.[0] ? (
          <p className="text-xs text-destructive">{state.errors.buy_x[0]}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {type === "buy_x_get_y"
            ? "Por cada X unidades en el alcance, el cliente se lleva Y gratis."
            : "Si lo dejas vacío, no hay restricción de cantidad. Cuenta solo las unidades dentro del alcance elegido."}
        </p>
      </div>

      <fieldset className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Alcance
        </legend>
        <div className="grid gap-1.5">
          <Label htmlFor="scope">¿A qué se aplica el descuento?</Label>
          <Select
            id="scope"
            name="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as PromotionRule["scope"])}
          >
            <option value="all">Todo el carrito</option>
            <option value="products">Productos específicos</option>
            <option value="categories">Categorías específicas</option>
            <option value="fotolibros">Fotolibros</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            {scope === "fotolibros"
              ? "La promo aplica solo a fotolibros en el carrito."
              : "Para \"Envío gratis\" el alcance no cambia el comportamiento — la promo aplica al envío del pedido al cumplir el mínimo de compra."}
          </p>
        </div>

        {scope === "fotolibros" ? (
          <div className="space-y-4">
            <OptionPicker
              label="Tamaños incluidos"
              inputName="photobook_size_cm"
              emptyText="No hay tamaños configurados en Ajustes → Fotolibros."
              options={photobookSizes.map((s) => ({
                value: String(s.cm),
                label: s.label,
                hint: s.sublabel,
              }))}
              selected={sizeSet}
              onToggle={(v) => toggle(sizeSet, v, setSizeSet)}
              allText="Sin selección aplica a todos los tamaños."
              someText="Solo los tamaños marcados cuentan."
            />
            <OptionPicker
              label="Páginas incluidas"
              inputName="photobook_page_count"
              emptyText="No hay paginados configurados en Ajustes → Fotolibros."
              options={photobookPageCounts.map((n) => ({
                value: String(n),
                label: `${n} páginas`,
              }))}
              selected={pageSet}
              onToggle={(v) => toggle(pageSet, v, setPageSet)}
              allText="Sin selección aplica a todos los paginados."
              someText="Solo los paginados marcados cuentan."
            />
            {sizeSet.size > 0 && pageSet.size > 0 ? (
              <p className="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
                El fotolibro debe cumplir <strong>ambas</strong> condiciones:
                estar entre los tamaños <em>y</em> entre los paginados
                marcados. Combinaciones que aplican:{" "}
                <strong>
                  {[...sizeSet]
                    .sort((a, b) => Number(a) - Number(b))
                    .flatMap((s) =>
                      [...pageSet]
                        .sort((a, b) => Number(a) - Number(b))
                        .map((p) => `${s}×${s} de ${p} pág.`),
                    )
                    .join(", ")}
                </strong>
                .
              </p>
            ) : null}
          </div>
        ) : null}

        {scope === "products" ? (
          <ScopePicker
            label="Productos incluidos"
            options={products}
            selected={productSet}
            onToggle={(id) => toggle(productSet, id, setProductSet)}
            inputName="product_ids"
          />
        ) : null}

        {scope === "categories" ? (
          <ScopePicker
            label="Categorías incluidas"
            options={categories}
            selected={categorySet}
            onToggle={(id) => toggle(categorySet, id, setCategorySet)}
            inputName="category_ids"
          />
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vigencia
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="starts_at">Empieza</Label>
            <Input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              defaultValue={toLocalInput(rule?.starts_at)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ends_at">Termina</Label>
            <Input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(rule?.ends_at)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Deja en blanco para promos sin fecha límite. La fecha se evalúa cada
          vez que un cliente carga el carrito o checkout.
        </p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="sort_order">Orden de prioridad</Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={rule?.sort_order ?? 0}
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <Checkbox
            name="active"
            defaultChecked={rule ? rule.active : true}
          />
          Activa
        </label>
      </div>

      {state?.message ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton edit={Boolean(rule)} />
      </div>
    </form>
  );
}

/**
 * Checkbox group over a fixed list of values (photobook sizes, page counts).
 * Unlike {@link ScopePicker} the options aren't DB rows — they come from the
 * photobook settings blob — so they're keyed by their literal value.
 */
function OptionPicker({
  label,
  inputName,
  options,
  selected,
  onToggle,
  emptyText,
  allText,
  someText,
}: {
  label: string;
  inputName: string;
  options: Array<{ value: string; label: string; hint?: string }>;
  selected: Set<string>;
  onToggle: (value: string) => void;
  emptyText: string;
  allText: string;
  someText: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {options.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div className="grid gap-1.5 rounded-md border border-border bg-background p-2 sm:grid-cols-2">
            {options.map((opt) => {
              const checked = selected.has(opt.value);
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1 text-sm",
                    checked && "bg-primary/10",
                  )}
                >
                  <Checkbox
                    name={inputName}
                    value={opt.value}
                    checked={checked}
                    onChange={() => onToggle(opt.value)}
                  />
                  <span className="truncate">
                    {opt.label}
                    {opt.hint ? (
                      <span className="text-muted-foreground"> · {opt.hint}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {selected.size === 0 ? allText : someText}
          </p>
        </>
      )}
    </div>
  );
}

function ScopePicker({
  label,
  options,
  selected,
  onToggle,
  inputName,
}: {
  label: string;
  options: IdName[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  inputName: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {options.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          No hay opciones creadas todavía.
        </p>
      ) : (
        <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border border-border bg-background p-2 sm:grid-cols-2">
          {options.map((opt) => {
            const checked = selected.has(opt.id);
            return (
              <label
                key={opt.id}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1 text-sm",
                  checked && "bg-primary/10",
                )}
              >
                <Checkbox
                  name={inputName}
                  value={opt.id}
                  checked={checked}
                  onChange={() => onToggle(opt.id)}
                />
                <span className="truncate">{opt.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubmitButton({ edit }: { edit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : edit ? "Guardar cambios" : "Crear promoción"}
    </Button>
  );
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
