import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendOrderPaidEmail,
  sendOrderShippedEmail,
  sendOrderReadyEmail,
  type OrderEmailItem,
  type OrderEmailShipTo,
  type BranchScheduleLine,
} from "@/lib/email";
import { logOrderEmail, type OrderEmailType } from "@/lib/order-email-log";

/**
 * Each of these helpers should only be called from the code path that
 * **just** flipped the order to the corresponding status — i.e. inside
 * the `previousStatus !== newStatus` guard. The order_status_history
 * insertion alongside is what guarantees idempotency: a later path that
 * sees the order already-in-this-status won't re-call us.
 *
 * They never throw: the outcome (sent / not sent and why) comes back as
 * a `NotifyResult` so callers that care — the admin status changer —
 * can surface it, while fire-and-forget callers (webhooks) can ignore it.
 */

export type NotifyResult =
  | { sent: true; to: string }
  | { sent: false; reason: string };

async function loadOrderForEmail(orderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, user_id, subtotal, shipping_cost, discount_amount, gift_card_amount, total, fulfillment, tracking_number, carrier, branch_id, address_snapshot",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const [{ data: user }, { data: profile }, { data: items }] = await Promise.all([
    admin.auth.admin.getUserById(order.user_id),
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", order.user_id)
      .maybeSingle(),
    admin
      .from("order_items")
      .select("product_name, variant_name, quantity, unit_price")
      .eq("order_id", orderId),
  ]);

  return {
    order,
    // Nullable: caller decides how to log a customer with no email.
    email: user?.user?.email ?? null,
    name: profile?.full_name ?? null,
    items: (items ?? []) as OrderEmailItem[],
  };
}

/**
 * Send outcome → NotifyResult, recording the attempt on the order's
 * email log along the way (visible in the admin timeline).
 */
async function settle(
  orderId: string,
  type: OrderEmailType,
  to: string,
  result: { ok: boolean; reason?: string },
): Promise<NotifyResult> {
  await logOrderEmail({
    orderId,
    type,
    recipient: to,
    success: result.ok,
    error: result.ok ? null : result.reason ?? "unknown",
  });
  return result.ok
    ? { sent: true, to }
    : { sent: false, reason: result.reason ?? "unknown" };
}

async function settleNoEmail(
  orderId: string,
  type: OrderEmailType,
): Promise<NotifyResult> {
  await logOrderEmail({
    orderId,
    type,
    recipient: null,
    success: false,
    error: "no_email",
  });
  return { sent: false, reason: "no_email" };
}

function shipToFromSnapshot(snapshot: unknown): OrderEmailShipTo | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as Record<string, unknown>;
  const str = (k: string) => (typeof s[k] === "string" && s[k] ? (s[k] as string) : null);
  const streetLine = [str("street"), str("ext_number"), str("int_number") ? `Int. ${str("int_number")}` : null]
    .filter(Boolean)
    .join(" ");
  const cityLine = [str("neighborhood"), str("zip"), str("city"), str("state")]
    .filter(Boolean)
    .join(", ");
  const lines = [streetLine, cityLine].filter((l) => l.length > 0);
  if (!lines.length && !str("recipient")) return null;
  return { recipient: str("recipient"), lines, phone: str("phone") };
}

export async function notifyOrderPaid(orderId: string): Promise<NotifyResult> {
  try {
    const data = await loadOrderForEmail(orderId);
    if (!data) return { sent: false, reason: "order_not_found" };
    if (!data.email) return settleNoEmail(orderId, "order_paid");

    let branchName: string | null = null;
    if (data.order.fulfillment === "pickup" && data.order.branch_id) {
      const { data: branch } = await createAdminClient()
        .from("branches")
        .select("name")
        .eq("id", data.order.branch_id)
        .maybeSingle();
      branchName = branch?.name ?? null;
    }

    const result = await sendOrderPaidEmail({
      to: data.email,
      name: data.name,
      orderId: data.order.id,
      items: data.items,
      totals: {
        subtotal: Number(data.order.subtotal),
        discount: Number(data.order.discount_amount ?? 0),
        shipping: Number(data.order.shipping_cost ?? 0),
        giftCard: Number(data.order.gift_card_amount ?? 0),
        total: Number(data.order.total),
      },
      fulfillment: data.order.fulfillment as "ship" | "pickup" | "digital",
      shipTo:
        data.order.fulfillment === "ship"
          ? shipToFromSnapshot(data.order.address_snapshot)
          : null,
      branchName,
    });
    return settle(orderId, "order_paid", data.email, result);
  } catch (e) {
    console.error("[notifyOrderPaid] failed:", e);
    const reason = e instanceof Error ? e.message : "unknown";
    await logOrderEmail({
      orderId,
      type: "order_paid",
      recipient: null,
      success: false,
      error: reason,
    });
    return { sent: false, reason };
  }
}

const CARRIER_TRACKING_URLS: Record<string, (n: string) => string> = {
  estafeta: (n) => `https://www.estafeta.com/Tracking/searchByGet?wayBill=${n}`,
  dhl: (n) => `https://www.dhl.com/mx-es/home/tracking.html?tracking-id=${n}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${n}`,
  paquetexpress: (n) => `https://www.paquetexpress.com.mx/rastreo?guia=${n}`,
};

export async function notifyOrderShipped(orderId: string): Promise<NotifyResult> {
  try {
    const data = await loadOrderForEmail(orderId);
    if (!data) return { sent: false, reason: "order_not_found" };
    if (!data.email) return settleNoEmail(orderId, "order_shipped");
    const carrier = data.order.carrier;
    const trackingNumber = data.order.tracking_number;
    const trackingUrl =
      carrier && trackingNumber
        ? CARRIER_TRACKING_URLS[carrier.toLowerCase()]?.(trackingNumber) ?? null
        : null;
    const result = await sendOrderShippedEmail({
      to: data.email,
      name: data.name,
      orderId: data.order.id,
      carrier,
      trackingNumber,
      trackingUrl,
    });
    return settle(orderId, "order_shipped", data.email, result);
  } catch (e) {
    console.error("[notifyOrderShipped] failed:", e);
    const reason = e instanceof Error ? e.message : "unknown";
    await logOrderEmail({
      orderId,
      type: "order_shipped",
      recipient: null,
      success: false,
      error: reason,
    });
    return { sent: false, reason };
  }
}

export async function notifyOrderReady(orderId: string): Promise<NotifyResult> {
  try {
    const data = await loadOrderForEmail(orderId);
    if (!data) return { sent: false, reason: "order_not_found" };
    if (!data.email) return settleNoEmail(orderId, "order_ready");
    const admin = createAdminClient();
    let branchName: string | null = null;
    let branchAddress: string | null = null;
    let branchSchedule: BranchScheduleLine[] | null = null;
    let branchHours: string | null = null;
    if (data.order.branch_id) {
      const { data: branch } = await admin
        .from("branches")
        .select("name, address, city, hours, hours_schedule")
        .eq("id", data.order.branch_id)
        .maybeSingle();
      if (branch) {
        const { hasAnySlot, parseBranchSchedule, scheduleAsLines } =
          await import("@/lib/branch-hours");
        branchName = branch.name;
        branchAddress = `${branch.address}, ${branch.city}`;
        // Prefer the structured schedule — passed through as a typed
        // array of weekday lines so the email can render it as a table.
        // Falls back to the legacy free-form `branches.hours` text
        // when the branch hasn't been migrated through admin yet.
        const schedule = parseBranchSchedule(branch.hours_schedule);
        if (hasAnySlot(schedule)) {
          branchSchedule = scheduleAsLines(schedule);
        } else {
          branchHours = branch.hours;
        }
      }
    }
    const result = await sendOrderReadyEmail({
      to: data.email,
      name: data.name,
      orderId: data.order.id,
      branchName,
      branchAddress,
      branchSchedule,
      branchHours,
    });
    return settle(orderId, "order_ready", data.email, result);
  } catch (e) {
    console.error("[notifyOrderReady] failed:", e);
    const reason = e instanceof Error ? e.message : "unknown";
    await logOrderEmail({
      orderId,
      type: "order_ready",
      recipient: null,
      success: false,
      error: reason,
    });
    return { sent: false, reason };
  }
}
