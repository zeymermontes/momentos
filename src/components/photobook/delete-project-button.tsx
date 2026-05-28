"use client";

import { useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProjectAction } from "@/app/(storefront)/fotolibro/actions";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteProjectAction(projectId);
    });
  }

  if (confirm) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
        <div className="relative w-full max-w-sm rounded-xl bg-card p-6 shadow-xl mx-4">
          <button
            onClick={() => setConfirm(false)}
            className="absolute right-3 top-3 rounded-md p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>

          <h3 className="text-lg font-bold">Eliminar fotolibro</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Se eliminarán todas las fotos y configuraciones de este fotolibro.
            Esta acción no se puede deshacer.
          </p>

          <div className="mt-4 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Eliminando..." : "Sí, eliminar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      aria-label="Eliminar fotolibro"
      title="Eliminar fotolibro"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 sm:px-3"
    >
      <Trash2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Eliminar fotolibro</span>
    </button>
  );
}
