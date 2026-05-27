"use client";

import { useState, useRef, useTransition } from "react";
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
import { Upload, Loader2, Pencil, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { optimizeImage } from "@/lib/image-optimize";
import { createClient } from "@/lib/supabase/client";
import {
  reorderPagesAction,
  assignImageToPageAction,
} from "@/app/(storefront)/fotolibro/actions";
import type { PhotobookPage } from "@/lib/photobook";

type Props = {
  projectId: string;
  pages: PhotobookPage[];
  userId: string;
};

export function PagesGrid({ projectId, pages: initialPages, userId }: Props) {
  const [pages, setPages] = useState(initialPages);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

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

  async function handleBulkUpload(files: FileList) {
    setUploading(true);
    setUploadProgress(0);
    const emptyPages = pages.filter((p) => !p.image_path);
    const toUpload = Math.min(files.length, emptyPages.length);

    for (let i = 0; i < toUpload; i++) {
      const file = files[i];
      const page = emptyPages[i];
      try {
        const optimized = await optimizeImage(file);
        const supabase = createClient();
        const path = `${userId}/photobooks/${projectId}/pages/${String(page.sort_order).padStart(3, "0")}.jpg`;
        await supabase.storage.from("customer-uploads").upload(path, optimized, {
          upsert: true,
          contentType: "image/jpeg",
        });

        const { data: signed } = await supabase.storage
          .from("customer-uploads")
          .createSignedUrl(path, 3600);

        setPages((prev) =>
          prev.map((p) =>
            p.id === page.id
              ? { ...p, image_path: path, image_url: signed?.signedUrl ?? null }
              : p,
          ),
        );

        startTransition(async () => {
          await assignImageToPageAction(projectId, page.id, path);
        });
      } catch (e) {
        console.error(`Failed to upload page ${i + 1}:`, e);
      }
      setUploadProgress(i + 1);
    }

    setUploading(false);
  }

  const filledCount = pages.filter((p) => p.image_path).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Páginas del fotolibro</h2>
          <p className="text-sm text-muted-foreground">
            {filledCount} de {pages.length} páginas con foto. Arrastra para reordenar.
          </p>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || filledCount >= pages.length}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadProgress}/{Math.min(pages.length - filledCount, uploadProgress + 1)}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Subir fotos
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
            handleBulkUpload(e.target.files);
          }
          e.target.value = "";
        }}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {pages.map((page) => (
              <SortablePage
                key={page.id}
                page={page}
                projectId={projectId}
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
  projectId,
}: {
  page: PhotobookPage;
  projectId: string;
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
      {page.image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.image_url}
            alt={`Página ${page.sort_order}`}
            className="h-full w-full object-contain p-[10%]"
          />
          <Link
            href={`/fotolibro/${projectId}/editar/${page.sort_order}`}
            className="absolute right-1 bottom-1 hidden rounded-md bg-background/90 p-1.5 shadow group-hover:block"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
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
        {page.sort_order}
      </span>
    </div>
  );
}
