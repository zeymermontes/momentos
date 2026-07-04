import { Clock, MailCheck, MailWarning, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
} from "@/lib/order-status";
import { ORDER_EMAIL_TYPE_LABEL } from "@/lib/order-email-log";

type HistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by_user_id: string | null;
  source: string;
  note: string | null;
  created_at: string;
};

type EmailRow = {
  id: string;
  email_type: string;
  recipient: string | null;
  success: boolean;
  error: string | null;
  created_at: string;
};

type TimelineEntry =
  | { kind: "status"; created_at: string; row: HistoryRow }
  | { kind: "email"; created_at: string; row: EmailRow };

const SOURCE_LABEL: Record<string, string> = {
  admin: "Admin",
  mp_webhook: "MercadoPago (webhook)",
  mp_process: "MercadoPago",
  checkout_success: "Confirmación de pago",
  checkout_create: "Checkout",
  system: "Sistema",
};

/**
 * Renders the audit log of status transitions for one order. Reads via the
 * admin client so it works both for the customer-facing detail page (where
 * the customer can only see their own orders by user_id) and the admin
 * page. RLS on `order_status_history` still enforces "owner or admin"
 * separately.
 */
export async function OrderStatusHistory({
  orderId,
  showEmails = false,
}: {
  orderId: string;
  /**
   * Admin-only: interleaves the order's email log (sent / failed) into
   * the timeline. Keep off for the customer-facing page — delivery
   * failures are an internal concern.
   */
  showEmails?: boolean;
}) {
  const admin = createAdminClient();
  const [{ data: rows }, { data: emailRows }] = await Promise.all([
    admin
      .from("order_status_history")
      .select(
        "id, from_status, to_status, changed_by_user_id, source, note, created_at",
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    showEmails
      ? admin
          .from("order_email_log")
          .select("id, email_type, recipient, success, error, created_at")
          .eq("order_id", orderId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);
  const history = (rows ?? []) as HistoryRow[];
  const emails = (emailRows ?? []) as EmailRow[];
  if (history.length === 0 && emails.length === 0) return null;

  const timeline: TimelineEntry[] = [
    ...history.map(
      (row): TimelineEntry => ({ kind: "status", created_at: row.created_at, row }),
    ),
    ...emails.map(
      (row): TimelineEntry => ({ kind: "email", created_at: row.created_at, row }),
    ),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Pull display names for the admins who appear in the log.
  const adminIds = Array.from(
    new Set(
      history
        .map((r) => r.changed_by_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const adminNames = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", adminIds);
    for (const p of profiles ?? []) {
      if (p.full_name) adminNames.set(p.id, p.full_name);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {showEmails ? "Historial del pedido" : "Historial de estados"}
        </h3>
      </header>
      <ol className="divide-y divide-border">
        {timeline.map((entry) => {
          if (entry.kind === "email") {
            return <EmailLogRow key={`email-${entry.row.id}`} row={entry.row} />;
          }
          const row = entry.row;
          const isSystem = row.changed_by_user_id === null;
          const who = isSystem
            ? "Sistema"
            : (adminNames.get(row.changed_by_user_id!) ?? "Admin");
          const sourceLabel = SOURCE_LABEL[row.source] ?? row.source;
          const when = new Date(row.created_at).toLocaleString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <li
              key={`status-${row.id}`}
              className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-2">
                {row.from_status ? (
                  <>
                    <Badge
                      variant={
                        ORDER_STATUS_BADGE[row.from_status] ?? "muted"
                      }
                    >
                      {ORDER_STATUS_LABEL[row.from_status] ?? row.from_status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">→</span>
                  </>
                ) : null}
                <Badge
                  variant={ORDER_STATUS_BADGE[row.to_status] ?? "muted"}
                >
                  {ORDER_STATUS_LABEL[row.to_status] ?? row.to_status}
                </Badge>
                {row.note ? (
                  <span className="text-xs text-muted-foreground">
                    · {row.note}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isSystem ? (
                  <Sparkles className="h-3 w-3" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                <span>{who}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{sourceLabel}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{when}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * One attempt from `order_email_log` rendered inside the order timeline:
 * which email, to whom, sent or failed (with the failure reason so the
 * admin can act without digging through server logs).
 */
function EmailLogRow({ row }: { row: EmailRow }) {
  const label = ORDER_EMAIL_TYPE_LABEL[row.email_type] ?? row.email_type;
  const when = new Date(row.created_at).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <li className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {row.success ? (
          <MailCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <MailWarning className="h-4 w-4 shrink-0 text-amber-600" />
        )}
        <span className="font-medium">Correo: {label}</span>
        <Badge variant={row.success ? "success" : "destructive"}>
          {row.success ? "Enviado" : "Falló"}
        </Badge>
        {row.recipient ? (
          <span className="text-xs text-muted-foreground">
            → {row.recipient}
          </span>
        ) : null}
        {!row.success && row.error ? (
          <span className="w-full text-xs text-destructive sm:w-auto">
            {describeEmailError(row.error)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{when}</span>
      </div>
    </li>
  );
}

function describeEmailError(error: string): string {
  if (error === "no_api_key") return "Servicio de correo no configurado";
  if (error === "no_email") return "El cliente no tiene correo asociado";
  if (error === "no_recipient") return "Sin correo de destinatario";
  return error;
}
