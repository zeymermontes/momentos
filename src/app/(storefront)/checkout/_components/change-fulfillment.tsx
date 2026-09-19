"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Truck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  changeFulfillmentAction,
  type CreateOrderState,
} from "@/app/(storefront)/checkout/actions";
import { cn } from "@/lib/utils";

type Address = {
  id: string;
  label: string;
  street: string;
  ext_number: string | null;
  zip: string;
  city: string;
};

type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
};

/**
 * Shown on the resume-payment page. The order already exists at that point,
 * so this edits the order's delivery instead of sending the customer back to
 * a checkout whose cart is gone.
 */
export function ChangeFulfillment({
  orderId,
  current,
  currentBranchId,
  summary,
  addresses,
  branches,
}: {
  orderId: string;
  current: "ship" | "pickup";
  currentBranchId: string | null;
  summary: string;
  addresses: Address[];
  branches: Branch[];
}) {
  const [state, formAction] = useActionState<
    CreateOrderState | undefined,
    FormData
  >(changeFulfillmentAction, undefined);
  const [open, setOpen] = useState(false);
  const [fulfillment, setFulfillment] = useState<"ship" | "pickup">(current);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [branchId, setBranchId] = useState(
    currentBranchId ?? branches[0]?.id ?? "",
  );

  const Icon = current === "ship" ? Truck : Store;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 text-sm">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">
              {current === "ship" ? "Envío a domicilio" : "Recoger en sucursal"}
            </p>
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          {open ? "Cancelar" : "Cambiar entrega"}
        </button>
      </div>

      {open ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="fulfillment" value={fulfillment} />
          {fulfillment === "ship" ? (
            <input type="hidden" name="address_id" value={addressId} />
          ) : (
            <input type="hidden" name="branch_id" value={branchId} />
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <OptionButton
              icon={Truck}
              title="Envío a domicilio"
              selected={fulfillment === "ship"}
              onClick={() => setFulfillment("ship")}
            />
            <OptionButton
              icon={Store}
              title="Recoger en sucursal"
              selected={fulfillment === "pickup"}
              onClick={() => setFulfillment("pickup")}
              disabled={branches.length === 0}
            />
          </div>

          {fulfillment === "ship" ? (
            addresses.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm">
                Aún no tienes direcciones guardadas.{" "}
                <Link
                  href={`/mi-cuenta/direcciones?next=/checkout/pagar/${orderId}`}
                  className="font-medium text-primary hover:underline"
                >
                  Agregar una dirección →
                </Link>
              </p>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="change-address">Dirección de envío</Label>
                <Select
                  id="change-address"
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.street} {a.ext_number ?? ""}, {a.zip}{" "}
                      {a.city}
                    </option>
                  ))}
                </Select>
              </div>
            )
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="change-branch">Sucursal para recoger</Label>
              <Select
                id="change-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.address}, {b.city}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            El total se actualiza con el costo de envío que corresponda.
          </p>

          {state?.message ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.message}
            </p>
          ) : null}

          <SaveButton
            disabled={
              (fulfillment === "ship" && !addressId) ||
              (fulfillment === "pickup" && !branchId)
            }
          />
        </form>
      ) : null}
    </div>
  );
}

function OptionButton({
  icon: Icon,
  title,
  selected,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition disabled:opacity-50",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/40",
      )}
    >
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </button>
  );
}

function SaveButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Guardando..." : "Guardar entrega"}
    </Button>
  );
}
