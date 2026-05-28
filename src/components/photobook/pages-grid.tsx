"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Upload, Loader2, Pencil, GripVertical, Trash2, X } from "lucide-react";
import { PageThumb } from "@/components/photobook/page-preview";
import { Button } from "@/components/ui/button";
import { optimizeImage } from "@/lib/image-optimize";
import { createClient } from "@/lib/supabase/client";
import { getPhotobookPrice } from "@/lib/photobook-config";
import type { PhotobookPage, PhotobookSettings } from "@/lib/photobook-config";
import {
  reorderPagesAction,
  assignImageToPageAction,
  clearPageImageAction,
  changePageCountAction,
} from "@/app/(storefront)/fotolibro/actions";

type Props = {
  projectId: string;
  pages: PhotobookPage[];
  userId: string;
  currentPageCount: number;
  sizeCm: number;
  settings: PhotobookSettings;
};

export function PagesGrid({ projectId, pages: initialPages, userId, currentPageCount, sizeCm, settings }: Props) {
  const [pages, setPages] = useState(initialPages);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Overflow popup state
  const [overflowPopup, setOverflowPopup] = useState<{
    totalPhotos: number;
    emptySlots: number;
    pendingFiles: File[];
  } | null>(null);
  const [pageCount, setPageCount] = useState(currentPageCount);
  const [resizePopup, setResizePopup] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...pages];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setPages(reordered);

    startTransition(async () => {
      await reorderPagesAction(projectId, reordered.map((p) => p.id));
    });
  }

  async function handleBulkUpload(files: File[], overridePages?: PhotobookPage[]) {
    setUploading(true);
    setUploadProgress(0);

    const source = overridePages ?? pages;
    const emptyPages = source.filter((p) => !p.image_path);
    const toUpload = Math.min(files.length, emptyPages.length);
    const supabase = createClient();

    for (let i = 0; i < toUpload; i++) {
      const file = files[i];
      const page = emptyPages[i];
      try {
        const { full, thumb } = await optimizeImage(file);
        const ts = `${Date.now()}_${i}`;
        const fullPath = `${userId}/photobooks/${projectId}/pages/${String(page.sort_order).padStart(3, "0")}_${ts}.jpg`;
        const tPath = `${userId}/photobooks/${projectId}/pages/${String(page.sort_order).padStart(3, "0")}_${ts}_thumb.webp`;
        const [{ error: e1 }, { error: e2 }] = await Promise.all([
          supabase.storage.from("customer-uploads").upload(fullPath, full, { contentType: "image/jpeg" }),
          supabase.storage.from("customer-uploads").upload(tPath, thumb, { contentType: "image/webp" }),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;

        const { data: signed } = await supabase.storage
          .from("customer-uploads")
          .createSignedUrl(tPath, 3600);

        setPages((prev) =>
          prev.map((p) =>
            p.id === page.id
              ? { ...p, image_path: fullPath, thumb_path: tPath, thumb_url: signed?.signedUrl ?? null }
              : p,
          ),
        );

        assignImageToPageAction(projectId, page.id, fullPath, tPath);
      } catch (e) {
        console.error(`Failed to upload page ${i + 1}:`, e);
      }
      setUploadProgress(i + 1);
    }

    setUploading(false);
  }

  function handleFilesSelected(fileList: FileList) {
    const files = Array.from(fileList);
    const emptySlots = pages.filter((p) => !p.image_path).length;

    if (files.length > emptySlots) {
      const higherOptions = settings.page_counts.filter((c) => c > pageCount);
      if (higherOptions.length > 0) {
        setOverflowPopup({ totalPhotos: files.length, emptySlots, pendingFiles: files });
        return;
      }
    }

    handleBulkUpload(files.slice(0, emptySlots));
  }

  async function handleChangePageCount(newCount: number) {
    const pending = overflowPopup?.pendingFiles ?? [];
    setOverflowPopup(null);
    setResizePopup(false);

    const result = await changePageCountAction(projectId, newCount);

    if (result.newPages && result.newPages.length > 0) {
      const added: PhotobookPage[] = result.newPages.map((p) => ({
        ...p,
        project_id: projectId,
        image_path: null,
        thumb_path: null,
        crop: { x: 0, y: 0, scale: 1, rotation: 0 },
        image_url: null,
        thumb_url: null,
      }));
      const updated = [...pages, ...added];
      setPages(updated);
      setPageCount(newCount);

      if (pending.length > 0) {
        const emptySlots = updated.filter((p) => !p.image_path).length;
        handleBulkUpload(pending.slice(0, emptySlots), updated);
      }
    } else if (result.removedIds && result.removedIds.length > 0) {
      const removedSet = new Set(result.removedIds);
      setPages((prev) => prev.filter((p) => !removedSet.has(p.id)));
      setPageCount(newCount);
    }
  }

  function handleUploadWithoutUpgrade() {
    if (!overflowPopup) return;
    const emptySlots = pages.filter((p) => !p.image_path).length;
    handleBulkUpload(overflowPopup.pendingFiles.slice(0, emptySlots));
    setOverflowPopup(null);
  }

  const filledCount = pages.filter((p) => p.image_path).length;
  const emptyCount = pages.length - filledCount;
  const canUpgrade = settings.page_counts.some((c) => c > pageCount);
  const allFull = emptyCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Páginas del fotolibro</h2>
          <p className="text-sm text-muted-foreground">
            {filledCount} de {pages.length} páginas con foto. Arrastra para reordenar.
            {" · "}
            <button
              type="button"
              onClick={() => setResizePopup(true)}
              className="text-primary hover:underline"
            >
              Cambiar páginas
            </button>
          </p>
        </div>
        <Button
          onClick={() => {
            if (allFull) {
              if (canUpgrade) {
                setOverflowPopup({ totalPhotos: 0, emptySlots: 0, pendingFiles: [] });
              }
            } else {
              inputRef.current?.click();
            }
          }}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadProgress} de {Math.min(emptyCount, uploadProgress + 1)}
            </>
          ) : allFull ? (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Agregar más páginas
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Subir fotos ({emptyCount})
            </>
          )}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files);
          }
          e.target.value = "";
        }}
      />

      {/* Overflow popup */}
      {overflowPopup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-xl mx-4">
            <button
              onClick={() => setOverflowPopup(null)}
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold">
              {overflowPopup.totalPhotos > 0 ? "Más fotos que páginas" : "Todas las páginas están llenas"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {overflowPopup.totalPhotos > 0 ? (
                <>
                  Seleccionaste <strong>{overflowPopup.totalPhotos} fotos</strong> pero solo
                  tienes <strong>{overflowPopup.emptySlots} páginas vacías</strong> ({pages.length} páginas en total).
                </>
              ) : (
                <>
                  Tu fotolibro de <strong>{pages.length} páginas</strong> está completo.
                  Puedes aumentar el número de páginas para agregar más fotos.
                </>
              )}
            </p>

            <div className="mt-4 space-y-2">
              {settings.page_counts.filter((c) => c > pageCount).map((option) => {
                const currentPrice = getPhotobookPrice(settings, sizeCm, pageCount);
                const newPrice = getPhotobookPrice(settings, sizeCm, option);
                const diff = newPrice - currentPrice;
                return (
                  <button
                    key={option}
                    onClick={() => handleChangePageCount(option)}
                    className="flex w-full items-center justify-between rounded-lg border-2 border-border p-3 text-sm transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="text-left">
                      <span>Cambiar a <strong>{option} páginas</strong></span>
                      <span className="block text-xs text-muted-foreground">
                        +{option - pageCount} páginas · ${newPrice} MXN total
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      +${diff} MXN
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              {overflowPopup.totalPhotos > 0 && overflowPopup.emptySlots > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleUploadWithoutUpgrade}
                >
                  Subir solo {overflowPopup.emptySlots}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOverflowPopup(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resize popup */}
      {resizePopup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-xl mx-4">
            <button
              onClick={() => setResizePopup(false)}
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold">Cambiar número de páginas</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Actualmente tienes <strong>{pages.length} páginas</strong> ({filledCount} con foto).
            </p>

            <div className="mt-4 space-y-2">
              {settings.page_counts.map((option) => {
                const isCurrent = option === pageCount;
                const currentPrice = getPhotobookPrice(settings, sizeCm, pageCount);
                const optionPrice = getPhotobookPrice(settings, sizeCm, option);
                const diff = optionPrice - currentPrice;
                const tooSmall = option < filledCount;

                return (
                  <button
                    key={option}
                    onClick={() => !isCurrent && !tooSmall && handleChangePageCount(option)}
                    disabled={isCurrent || tooSmall}
                    className={
                      isCurrent
                        ? "flex w-full items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-3 text-sm"
                        : tooSmall
                          ? "flex w-full items-center justify-between rounded-lg border-2 border-border p-3 text-sm opacity-50 cursor-not-allowed"
                          : "flex w-full items-center justify-between rounded-lg border-2 border-border p-3 text-sm transition hover:border-primary hover:bg-primary/5"
                    }
                  >
                    <div className="text-left">
                      <span>
                        <strong>{option} páginas</strong>
                        {isCurrent && <span className="ml-2 text-xs text-primary">(actual)</span>}
                      </span>
                      {tooSmall && !isCurrent && (
                        <span className="block text-xs text-destructive">
                          Tienes {filledCount} fotos, no caben en {option}
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        ${optionPrice} MXN
                      </span>
                    </div>
                    {!isCurrent && !tooSmall && (
                      <span className={`text-xs font-semibold ${diff > 0 ? "text-primary" : "text-emerald-600"}`}>
                        {diff > 0 ? `+$${diff}` : `-$${Math.abs(diff)}`} MXN
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={() => setResizePopup(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {pages.map((page, index) => (
              <SortablePage
                key={page.id}
                page={page}
                displayNum={index + 1}
                projectId={projectId}
                onDelete={(id) => {
                  setPages((prev) =>
                    prev.map((p) =>
                      p.id === id
                        ? { ...p, image_path: null, thumb_path: null, image_url: null, thumb_url: null }
                        : p,
                    ),
                  );
                  clearPageImageAction(projectId, id);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex justify-end">
        <Link href={`/fotolibro/${projectId}/preview`}>
          <Button disabled={filledCount === 0}>Ver vista previa 3D</Button>
        </Link>
      </div>
    </div>
  );
}

function SortablePage({
  page,
  displayNum,
  projectId,
  onDelete,
}: {
  page: PhotobookPage;
  displayNum: number;
  projectId: string;
  onDelete: (pageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-white shadow-sm"
    >
      {(page.thumb_url || page.image_url) ? (
        <>
          <PageThumb
            src={page.thumb_url ?? page.image_url!}
            crop={page.crop}
          />
          <div className="absolute right-1 bottom-1 hidden items-center gap-1 group-hover:flex">
            <Link
              href={`/fotolibro/${projectId}/editar/${page.sort_order}`}
              className="rounded-md bg-background/90 p-1.5 shadow hover:bg-background"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => onDelete(page.id)}
              className="rounded-md bg-background/90 p-1.5 shadow hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        </>
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground/40">
          <span className="text-xs">Vacía</span>
        </div>
      )}

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 hidden cursor-grab rounded-md bg-background/90 p-1 shadow group-hover:block"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Page number */}
      <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {displayNum}
      </span>
    </div>
  );
}
