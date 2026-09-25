import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PaymentBrick } from "@/app/(storefront)/checkout/_components/payment-brick";
import { ChangeFulfillment } from "@/app/(storefront)/checkout/_components/change-fulfillment";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getPendingVoucher } from "@/lib/mercadopago";
import { cn, formatMXN } from "@/lib/utils";
import { isPhotobookCustomization } from "@/lib/photobook-config";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_BADGE,
} from "@/lib/order-status";

export const metadata = { title: "Continuar pago" };
export const dynamic = "force-dynamic";

type Params = Promise<{ orderId: string }>;
type SearchParams = Promise<{ nuevo?: string }>;

export default async function ResumePaymentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { orderId } = await params;
  const { nuevo } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, total, shipping_cost, payment_status, payment_id, fulfillment, address_snapshot, branch_id, created_at",
    )
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) notFound();

  // If the order is already paid (or beyond), just send the user to its
  // detail page — nothing left to do here.
  if (order.status !== "pending" || order.payment_status === "approved") {
    redirect(`/mi-cuenta/pedidos/${order.id}`);
  }

  // If there's an existing cash voucher and the user didn't explicitly ask
  // for a new payment method, show the voucher instead of a fresh brick.
  const voucher = nuevo
    ? null
    : await getPendingVoucher(order.payment_id ?? null);
  const voucherExpiresAt = voucher?.expirationDate
    ? new Date(voucher.expirationDate).toLocaleString("es-MX", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;
  const isBankTransfer =
    voucher?.paymentMethodId === "pse" ||
    voucher?.paymentMethodId === "bank_transfer" ||
    voucher?.paymentMethodId === "spei";

  // Delivery can still be changed while nothing has been paid. Once a
  // voucher / transfer exists for the current total, it's locked.
  const canChangeFulfillment =
    !voucher && (order.fulfillment === "ship" || order.fulfillment === "pickup");
  const [{ data: addresses }, { data: branches }, { data: orderItems }] = canChangeFulfillment
    ? await Promise.all([
        supabase
          .from("addresses")
          .select("id, label, street, ext_number, zip, city")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("branches")
          .select("id, name, address, city")
          .eq("active", true)
          .order("name"),
        supabase
          .from("order_items")
          .select("customization")
          .eq("order_id", order.id),
      ])
    : [{ data: null }, { data: null }, { data: null }];
  const hasPhotobook = (orderItems ?? []).some((i) =>
    isPhotobookCustomization(i.customization),
  );

  const snapshot = order.address_snapshot as {
    street?: string;
    ext_number?: string | null;
    zip?: string;
    city?: string;
  } | null;
  const shippingCost = Number(order.shipping_cost);
  const fulfillmentSummary =
    order.fulfillment === "ship"
      ? `${snapshot?.street ?? ""} ${snapshot?.ext_number ?? ""}, ${snapshot?.zip ?? ""} ${snapshot?.city ?? ""} · ${shippingCost > 0 ? formatMXN(shippingCost) : "Envío gratis"}`
      : `${(branches ?? []).find((b) => b.id === order.branch_id)?.name ?? "Sucursal"} · Sin costo de envío`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/mi-cuenta/pedidos/${order.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Volver al pedido
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight">Continuar pago</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Estás retomando el pago de un pedido que dejaste pendiente.
      </p>

      <Card className="mt-6">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Pedido</p>
              <code className="font-mono text-sm">#{order.id.slice(0, 8)}</code>
            </div>
            <Badge variant={ORDER_STATUS_BADGE[order.status] ?? "muted"}>
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </Badge>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total a pagar</span>
            <span className="text-2xl font-bold">
              {formatMXN(Number(order.total))}
            </span>
          </div>
          {canChangeFulfillment ? (
            <ChangeFulfillment
              key={fulfillmentSummary}
              orderId={order.id}
              current={order.fulfillment as "ship" | "pickup"}
              currentBranchId={order.branch_id}
              summary={fulfillmentSummary}
              addresses={addresses ?? []}
              branches={branches ?? []}
              hasPhotobook={hasPhotobook}
            />
          ) : null}
        </CardContent>
      </Card>

      {voucher ? (
        <div className="mt-6 space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-2 text-amber-900">
            <FileText className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold">
                {isBankTransfer
                  ? "Datos para tu transferencia"
                  : "Comprobante de pago en efectivo"}
              </h2>
              <p className="text-sm text-amber-800">
                {isBankTransfer
                  ? "Ya generamos los datos de transferencia para este pedido. Ábrelos y haz la transferencia desde tu banca en línea o app."
                  : "Ya generamos un comprobante para este pedido. Preséntalo en la sucursal para finalizar tu compra."}
              </p>
            </div>
          </div>

          {voucher.ticketUrl ? (
            <a
              href={voucher.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg" }), "w-full gap-2")}
            >
              <FileText className="h-4 w-4" />
              {isBankTransfer
                ? "Ver datos de transferencia"
                : "Abrir comprobante de pago"}
            </a>
          ) : null}

          {voucher.barcodeContent ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-900">
                Código de referencia
              </p>
              <code className="block w-full break-all rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-xs">
                {voucher.barcodeContent}
              </code>
            </div>
          ) : null}

          {voucherExpiresAt ? (
            <p className="text-sm text-amber-900">
              <strong>Vence:</strong> {voucherExpiresAt}
            </p>
          ) : null}

          <div className="border-t border-amber-200 pt-3 text-sm text-amber-800">
            ¿Prefieres pagar con otro método?{" "}
            <Link
              href={`/checkout/pagar/${order.id}?nuevo=1`}
              className="font-medium underline"
            >
              Elige otro método de pago
            </Link>
            .
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Datos de pago</h2>
          <PaymentBrick
            key={String(order.total)}
            orderId={order.id}
            total={Number(order.total)}
            publicKey={env.MERCADOPAGO_PUBLIC_KEY}
            email={user.email ?? ""}
          />
        </div>
      )}

      <Link
        href="/mi-cuenta/pedidos"
        className={buttonVariants({ variant: "outline" }) + " mt-6"}
      >
        Volver a mis pedidos
      </Link>
    </div>
  );
}
