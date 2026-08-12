import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mpPayment } from "@/lib/mercadopago";

/**
 * Idempotency scope for one attempt.
 *
 * Keying on the order alone stopped double-charges but also made MercadoPago
 * replay its stored answer for every later attempt on that order — so a
 * customer who mistyped their CVV, fixed it and submitted again got the
 * original rejection back, and the error looked permanent.
 *
 * Card tokens are single-use and re-minted on each submit, so folding the
 * token in keeps the double-click protection (same submit, same token, same
 * key) while letting a genuine retry through as a new attempt.
 *
 * Methods without a token (cash vouchers, transfers) keep the per-order key:
 * there is no "fix and retry" for them, and replaying beats issuing a second
 * voucher for the same order.
 */
function idempotencyKeyFor(
  orderId: string,
  body: Record<string, unknown>,
): string {
  const token = typeof body.token === "string" ? body.token : null;
  return token ? `order-${orderId}-${token}` : `order-${orderId}`;
}

type Enrichment = {
  payer: Record<string, unknown>;
  additionalInfo: Record<string, unknown>;
};

/**
 * Payer identity and order contents for MercadoPago's risk scoring. Best
 * effort: any missing piece is simply omitted rather than blocking the charge,
 * since a thinner payload still pays — it just scores worse.
 */
async function buildRiskEnrichment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orderId: string,
  addressSnapshot: unknown,
): Promise<Enrichment> {
  const [{ data: profile }, { data: items }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("product_name, variant_name, quantity, unit_price")
      .eq("order_id", orderId),
  ]);

  const fullName = (profile?.full_name ?? "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");

  const addr =
    addressSnapshot && typeof addressSnapshot === "object"
      ? (addressSnapshot as Record<string, unknown>)
      : null;
  const street = typeof addr?.street === "string" ? addr.street : undefined;
  const streetNumber =
    typeof addr?.ext_number === "string" ? addr.ext_number : undefined;
  const zip = typeof addr?.zip === "string" ? addr.zip : undefined;
  const phone = (profile?.phone ?? (addr?.phone as string | undefined)) || undefined;

  const payerInfo: Record<string, unknown> = {};
  if (firstName) payerInfo.first_name = firstName;
  if (lastName) payerInfo.last_name = lastName;
  if (phone) payerInfo.phone = { number: phone };
  if (street || zip) {
    payerInfo.address = {
      ...(zip ? { zip_code: zip } : {}),
      ...(street ? { street_name: street } : {}),
      ...(streetNumber ? { street_number: streetNumber } : {}),
    };
  }

  const additionalInfo: Record<string, unknown> = {};
  if (items && items.length > 0) {
    additionalInfo.items = items.map((i) => ({
      id: orderId.slice(0, 8),
      title: [i.product_name, i.variant_name].filter(Boolean).join(" — "),
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      currency_id: "MXN",
    }));
  }
  if (Object.keys(payerInfo).length > 0) additionalInfo.payer = payerInfo;
  if (street || zip) {
    additionalInfo.shipments = { receiver_address: payerInfo.address };
  }

  // `payer` on the payment itself takes only identity fields; the address and
  // item list belong under additional_info.
  const payer: Record<string, unknown> = {};
  if (firstName) payer.first_name = firstName;
  if (lastName) payer.last_name = lastName;

  return { payer, additionalInfo };
}

/**
 * Processes a payment submitted by the MercadoPago Payment Brick.
 *
 * Body shape: the brick's `formData` (token, payment_method_id, payer,
 * transaction_amount, etc.) plus an `order_id` we add client-side so we know
 * which order this payment belongs to.
 *
 * Security:
 *  - Verify the order exists and belongs to the authenticated user.
 *  - Verify the amount matches the server-side order total — otherwise a
 *    malicious client could tamper with the brick's amount.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id : null;
  if (!orderId) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, total, status, payment_status, address_snapshot")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "Order already processed", status: order.status },
      { status: 409 },
    );
  }

  const orderTotal = Number(order.total);
  const submittedAmount = Number(body.transaction_amount);
  if (
    !Number.isFinite(submittedAmount) ||
    Math.abs(submittedAmount - orderTotal) > 0.01
  ) {
    return NextResponse.json(
      { error: "Amount mismatch" },
      { status: 400 },
    );
  }

  // Everything MercadoPago's risk engine can score on. The brick only sends a
  // token, an amount and an email; name, phone, address and the item list are
  // ours to add, and they are exactly the signals that decide borderline calls
  // like cc_rejected_high_risk.
  const enrichment = await buildRiskEnrichment(
    supabase,
    user.id,
    orderId,
    order.address_snapshot,
  );

  // Build the MP Payment payload. We trust the brick to send the right shape
  // for the chosen payment method (card token, payer info, etc.).
  const brickPayer = (body.payer ?? {}) as Record<string, unknown>;
  const paymentBody = {
    ...(body as Record<string, unknown>),
    payer: { ...enrichment.payer, ...brickPayer },
    additional_info: enrichment.additionalInfo,
    transaction_amount: orderTotal,
    external_reference: orderId,
    description: `Momentos pedido ${orderId.slice(0, 8)}`,
    metadata: { order_id: orderId, user_id: user.id },
  };
  // Strip our own field that MP doesn't expect.
  delete (paymentBody as Record<string, unknown>).order_id;

  let mpResult;
  try {
    mpResult = await mpPayment().create({
      body: paymentBody,
      requestOptions: {
        idempotencyKey: idempotencyKeyFor(orderId, body),
      },
    });
  } catch (e: unknown) {
    const errorObj = e as { message?: string; cause?: { error?: string }; status?: number };
    console.error("[mp] payment create failed:", e);
    return NextResponse.json(
      {
        error:
          errorObj?.cause?.error ??
          errorObj?.message ??
          "MercadoPago rejected the payment",
        status: errorObj?.status ?? 502,
      },
      { status: 502 },
    );
  }

  // Persist the result. Use the admin client because orders.update has an
  // is_admin() RLS policy — the customer can read their order but not update
  // payment fields directly.
  const admin = createAdminClient();
  const newStatus =
    mpResult.status === "approved"
      ? "paid"
      : mpResult.status === "rejected"
        ? "pending"
        : "pending";

  const { data: prevOrder } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  const previousStatus = prevOrder?.status ?? null;

  await admin
    .from("orders")
    .update({
      payment_id: String(mpResult.id ?? ""),
      payment_status: mpResult.status ?? "unknown",
      payment_status_detail: mpResult.status_detail ?? null,
      status: newStatus,
    })
    .eq("id", orderId);

  if (newStatus !== previousStatus) {
    await admin.from("order_status_history").insert({
      order_id: orderId,
      from_status: previousStatus,
      to_status: newStatus,
      changed_by_user_id: null,
      source: "mp_process",
    });
    if (newStatus === "paid") {
      try {
        const { notifyOrderPaid } = await import("@/lib/order-notifications");
        await notifyOrderPaid(orderId);
      } catch (e) {
        console.error("[payment/process] notifyOrderPaid failed:", e);
      }
    }
  }

  if (mpResult.status === "approved") {
    const { data: cart } = await admin
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cart) {
      await admin.from("cart_items").delete().eq("cart_id", cart.id);
    }
    // Issue gift cards for any gift-card items on this order. Idempotent
    // — the webhook may also fire this, but the unique index on
    // order_item_id makes the duplicate insert a no-op.
    try {
      const { issueGiftCardsForPaidOrder, redeemPendingGiftCardForOrder } =
        await import("@/lib/gift-cards-server");
      await redeemPendingGiftCardForOrder(orderId);
      await issueGiftCardsForPaidOrder(orderId);
    } catch (e) {
      console.error("[payment/process] gift card hook failed:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    status: mpResult.status,
    statusDetail: mpResult.status_detail,
    paymentId: mpResult.id,
    orderId,
  });
}
