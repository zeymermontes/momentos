"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  Plus,
  Trash2,
  Type,
  AlignLeft,
  Hash,
  List,
  Upload,
  Eye,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  addCustomizationFieldAction,
  deleteCustomizationFieldAction,
  updateCustomizationFieldVisibilityAction,
  type CustomFieldActionState,
} from "@/app/admin/productos/actions";
import { slugify } from "@/lib/slugify";
import { cn, formatMXN } from "@/lib/utils";

type CustomField = {
  id: string;
  type: "text" | "textarea" | "number" | "dropdown" | "file";
  name: string;
  label: string;
  required: boolean;
  options: unknown;
  price_delta_rules: unknown;
  visible_variant_ids: unknown;
};

type VariantOption = { id: string; name: string };

const TYPE_META: Record<CustomField["type"], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  text: { label: "Texto corto", icon: Type },
  textarea: { label: "Texto largo", icon: AlignLeft },
  number: { label: "Número", icon: Hash },
  dropdown: { label: "Lista de opciones", icon: List },
  file: { label: "Subir archivo", icon: Upload },
};

export function CustomizationFieldsSection({
  productId,
  fields,
  variants,
}: {
  productId: string;
  fields: CustomField[];
  variants: VariantOption[];
}) {
  return (
    <div className="space-y-4">
      {fields.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              productId={productId}
              field={f}
              variants={variants}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Sin campos de personalización. Agrega abajo el primero para que los
          clientes puedan llenar datos al pedir este producto.
        </p>
      )}

      <AddFieldForm productId={productId} variants={variants} />
    </div>
  );
}

function FieldRow({
  productId,
  field,
  variants,
}: {
  productId: string;
  field: CustomField;
  variants: VariantOption[];
}) {
  const Icon = TYPE_META[field.type].icon;
  const options = Array.isArray(field.options) ? (field.options as string[]) : [];
  const rules = (field.price_delta_rules ?? null) as Record<string, number> | null;
  const initialVariantIds = Array.isArray(field.visible_variant_ids)
    ? (field.visible_variant_ids as string[])
    : [];

  const [selectedIds, setSelectedIds] = useState<string[]>(initialVariantIds);
  const [editingVisibility, setEditingVisibility] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isAlwaysVisible = selectedIds.length === 0;
  // A variant that was deleted after this field was scoped to it will
  // still show up in selectedIds but not in the variants prop. Drop those
  // ghosts from the displayed summary so the admin doesn't see a confusing
  // "Solo en (sin variantes)" line.
  const liveVariantIds = new Set(variants.map((v) => v.id));
  const liveSelectedIds = selectedIds.filter((id) => liveVariantIds.has(id));
  const visibleVariantNames = variants
    .filter((v) => liveSelectedIds.includes(v.id))
    .map((v) => v.name);

  function toggleVariant(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function saveVisibility() {
    startTransition(async () => {
      await updateCustomizationFieldVisibilityAction(
        productId,
        field.id,
        selectedIds,
      );
      setEditingVisibility(false);
    });
  }

  function cancelEdit() {
    setSelectedIds(initialVariantIds);
    setEditingVisibility(false);
  }

  return (
    <li className="space-y-3 p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{field.label}</span>
            <Badge variant="muted">{TYPE_META[field.type].label}</Badge>
            {field.required ? (
              <Badge variant="default">Requerido</Badge>
            ) : null}
            <code className="ml-auto text-xs text-muted-foreground">
              {field.name}
            </code>
          </div>
          {options.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {options.map((opt) => (
                <li
                  key={opt}
                  className="rounded-md border border-border bg-background px-2 py-0.5"
                >
                  {opt}
                  {rules?.[opt] !== undefined && rules[opt] !== 0 ? (
                    <span className="ml-1 text-muted-foreground">
                      ({rules[opt] > 0 ? "+" : ""}
                      {formatMXN(rules[opt])})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <DeleteFieldButton productId={productId} fieldId={field.id} />
      </div>

      {/* Visibility controls — only show when product has variants worth scoping to. */}
      {variants.length > 0 ? (
        <div className="rounded-md bg-muted/40 px-3 py-2">
          {!editingVisibility ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Visible:</span>
              {isAlwaysVisible || visibleVariantNames.length === 0 ? (
                <span className="font-medium">Siempre (todas las variantes)</span>
              ) : (
                <span className="font-medium">
                  Solo en {visibleVariantNames.join(", ")}
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditingVisibility(true)}
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Deja todo desmarcado para que este campo siempre se vea, o marca
                las variantes en las que aparece.
              </p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {variants.map((v) => {
                  const checked = selectedIds.includes(v.id);
                  return (
                    <li key={v.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm hover:bg-muted",
                          checked && "border-primary bg-primary/5",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleVariant(v.id)}
                        />
                        <span className="truncate">{v.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={saveVisibility}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  {isPending ? "Guardando..." : "Guardar visibilidad"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function DeleteFieldButton({
  productId,
  fieldId,
}: {
  productId: string;
  fieldId: string;
}) {
  const action = deleteCustomizationFieldAction.bind(null, productId, fieldId);
  return (
    <form action={action}>
      <button
        type="submit"
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-destructive hover:bg-destructive/10"
        onClick={(e) => {
          if (!confirm("¿Eliminar este campo?")) e.preventDefault();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function AddFieldForm({
  productId,
  variants,
}: {
  productId: string;
  variants: VariantOption[];
}) {
  const bound = addCustomizationFieldAction.bind(null, productId);

  const [type, setType] = useState<CustomField["type"]>("text");
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [visibleVariantIds, setVisibleVariantIds] = useState<string[]>([]);

  const [state, formAction] = useActionState<
    CustomFieldActionState | undefined,
    FormData
  >(async (prev, formData) => {
    const result = await bound(prev, formData);
    if (result && !result.errors && !result.message) {
      setType("text");
      setLabel("");
      setName("");
      setNameTouched(false);
      setOptionsText("");
      setVisibleVariantIds([]);
    }
    return result;
  }, undefined);

  const options = optionsText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  function toggleVariant(id: string) {
    setVisibleVariantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-md border border-border bg-background p-4"
    >
      <h4 className="text-sm font-semibold">Agregar campo</h4>

      <input
        type="hidden"
        name="visible_variant_ids"
        value={visibleVariantIds.join(",")}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="cf-label">Etiqueta visible al cliente</Label>
          <Input
            id="cf-label"
            name="label"
            required
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!nameTouched) setName(slugify(e.target.value).replaceAll("-", "_"));
            }}
            placeholder="Nombre, Acabado, Logo..."
          />
          {state?.errors?.label?.[0] ? (
            <p className="text-xs text-destructive">{state.errors.label[0]}</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="cf-name">Clave interna (sin espacios)</Label>
          <Input
            id="cf-name"
            name="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            placeholder="nombre"
          />
          {state?.errors?.name?.[0] ? (
            <p className="text-xs text-destructive">{state.errors.name[0]}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor="cf-type">Tipo</Label>
          <Select
            id="cf-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as CustomField["type"])}
          >
            <option value="text">Texto corto</option>
            <option value="textarea">Texto largo</option>
            <option value="number">Número</option>
            <option value="dropdown">Lista de opciones</option>
            <option value="file">Subir archivo</option>
          </Select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <Checkbox name="required" />
          Requerido
        </label>
      </div>

      {type === "dropdown" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="cf-options">Opciones (una por línea)</Label>
          <Textarea
            id="cf-options"
            name="options"
            rows={4}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={"Mate\nBrillante\nUV selectivo"}
          />
          {options.length > 0 ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Precio extra por opción (opcional)
              </p>
              <ul className="space-y-1.5">
                {options.map((opt) => (
                  <li key={opt} className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{opt}</span>
                    <span className="text-xs text-muted-foreground">+ MXN</span>
                    <Input
                      type="number"
                      step="0.01"
                      name={`price_delta__${opt}`}
                      className="w-24"
                      defaultValue="0"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {variants.length > 0 ? (
        <div className="grid gap-1.5">
          <Label>Visibilidad por variante (opcional)</Label>
          <p className="text-xs text-muted-foreground">
            Si no marcas ninguna, el campo se ve en todas las variantes. Marca
            las variantes en las que quieres que este campo aparezca.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {variants.map((v) => {
              const checked = visibleVariantIds.includes(v.id);
              return (
                <li key={v.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm hover:bg-muted",
                      checked && "border-primary bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleVariant(v.id)}
                    />
                    <span className="truncate">{v.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {state?.message ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
      <Plus className="h-3.5 w-3.5" />
      {pending ? "Agregando..." : "Agregar campo"}
    </Button>
  );
}
