import Link from "next/link";
import { Package, Book, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { formatMXN, cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_BADGE,
  formatOrderDate,
} from "@/lib/order-status";

export const metadata = { title: "Mis pedidos" };
export const dynamic = "force-dynamic";

const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft: "En edición",
  completed: "Listo",
  ordered: "Pedido realizado",
};

const PROJECT_STATUS_BADGE: Record<string, "default" | "warning" | "success"> = {
  draft: "warning",
  completed: "default",
  ordered: "success",
};

export default async function MyOrdersPage() {
  const { supabase, user } = await requireUser();

  const [{ data: orders }, { data: projects }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, total, fulfillment, created_at, payment_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("photobook_projects")
      .select("id, size_cm, page_count, title, status, created_at, updated_at")
      .eq("user_id", user.id)
      .in("status", ["draft", "completed"])
      .order("updated_at", { ascending: false }),
  ]);

  const activeProjects = projects ?? [];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-xl font-bold tracking-tight">Mis pedidos</h2>
        <p className="text-sm text-muted-foreground">
          Historial de tus compras en Momentos.
        </p>
      </header>

      {/* Active photobook projects */}
      {activeProjects.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
            <Book className="h-4 w-4" />
            Fotolibros en progreso
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeProjects.map((p) => {
              const step =
                p.status === "completed"
                  ? "preview"
                  : "configuracion";
              return (
                <Link
                  key={p.id}
                  href={`/fotolibro/${p.id}/${step}`}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:shadow-sm"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Book className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {p.title || "Fotolibro sin título"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.size_cm}×{p.size_cm} cm · {p.page_count} páginas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={PROJECT_STATUS_BADGE[p.status] ?? "muted"}>
                      {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Orders */}
      {(orders?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no has hecho ningún pedido"
          description="Cuando compres algo, aparecerá aquí."
          action={
            <Link
              href="/productos"
              className={buttonVariants({ variant: "default" })}
            >
              Explorar productos
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">
                    #{o.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatOrderDate(o.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ORDER_STATUS_BADGE[o.status] ?? "muted"}>
                      {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatMXN(Number(o.total))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/mi-cuenta/pedidos/${o.id}`}
                      className="text-xs font-medium hover:text-primary"
                    >
                      Ver detalle →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
