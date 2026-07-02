import Link from "next/link";
import { Book, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/admin/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { formatMXN } from "@/lib/utils";
import { getPhotobookSettings, getPhotobookPrice } from "@/lib/photobook";

export const metadata = { title: "Fotolibros — Admin" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "En edición",
  completed: "Listo",
  ordered: "Pedido",
};

const STATUS_BADGE: Record<string, "warning" | "default" | "success"> = {
  draft: "warning",
  completed: "default",
  ordered: "success",
};

export default async function AdminPhotobooksPage() {
  const { supabase } = await requireAdmin();
  const settings = await getPhotobookSettings();

  const { data: projects } = await supabase
    .from("photobook_projects")
    .select("id, size_cm, page_count, title, status, created_at, updated_at, user_id, print_sheets, hardcover")
    .order("updated_at", { ascending: false });

  const userIds = [...new Set((projects ?? []).map((p) => p.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const items = (projects ?? []).map((p) => ({
    ...p,
    profile_name: profileMap.get(p.user_id) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Fotolibros</h2>
        <Link
          href="/admin/configuracion"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Configuración
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Book}
          title="Sin fotolibros"
          description="Aún no hay fotolibros creados por clientes."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Páginas</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    {p.profile_name || p.user_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.title || "Sin título"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span>{p.size_cm}×{p.size_cm} cm</span>
                      <Badge variant={p.hardcover ? "default" : "muted"} className="w-fit">
                        {p.hardcover ? "Pasta dura" : "Pasta blanda"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.page_count}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatMXN(getPhotobookPrice(settings, p.size_cm, p.page_count, p.hardcover))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={STATUS_BADGE[p.status] ?? "muted"}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                      {p.status === "ordered" && (
                        <span
                          className={
                            Array.isArray(p.print_sheets) && p.print_sheets.length > 0
                              ? "text-[10px] text-emerald-700"
                              : "text-[10px] text-amber-700"
                          }
                        >
                          {Array.isArray(p.print_sheets) && p.print_sheets.length > 0
                            ? "✓ Listo para imprimir"
                            : "⏳ Falta generar hojas"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/fotolibros/${p.id}`}
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
