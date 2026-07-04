import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type OrderEmailType =
  | "order_paid"
  | "order_shipped"
  | "order_ready"
  | "gift_card_recipient"
  | "gift_card_buyer";

export const ORDER_EMAIL_TYPE_LABEL: Record<string, string> = {
  order_paid: "Confirmación de pedido",
  order_shipped: "Pedido en camino",
  order_ready: "Listo para recoger",
  gift_card_recipient: "Gift card al destinatario",
  gift_card_buyer: "Gift cards al comprador",
};

/**
 * Records one email attempt on the order's log so the admin timeline can
 * show what actually reached the customer. Best-effort: a logging failure
 * must never break the send path, so errors are only console'd.
 */
export async function logOrderEmail(args: {
  orderId: string;
  type: OrderEmailType;
  recipient: string | null;
  success: boolean;
  error?: string | null;
}): Promise<void> {
  try {
    await createAdminClient().from("order_email_log").insert({
      order_id: args.orderId,
      email_type: args.type,
      recipient: args.recipient,
      success: args.success,
      error: args.error ?? null,
    });
  } catch (e) {
    console.error("[order-email-log] insert failed:", e);
  }
}
