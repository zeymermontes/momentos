"use client";

import { useState, useRef, useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageCropper } from "@/components/photobook/image-cropper";
import { optimizeImage, getImageDimensions } from "@/lib/image-optimize";
import { createClient } from "@/lib/supabase/client";
import { updateCoverAction, type ActionState } from "@/app/(storefront)/fotolibro/actions";
import type { CropState, PhotobookProject } from "@/lib/photobook";

type Props = {
  project: PhotobookProject;
  coverUrl: string | null;
  userId: string;
};

export function CoverEditor({ project, coverUrl, userId }: Props) {
  const [imagePath, setImagePath] = useState(project.cover_image_path ?? "");
  const [imageUrl, setImageUrl] = useState(coverUrl ?? "");
  const [imgDims, setImgDims] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<CropState>(project.cover_crop);
  const [title, setTitle] = useState(project.title);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<ActionState | undefined, FormData>(
    updateCoverAction,
    undefined,
  );

  async function loadDimensions(url: string) {
    try {
      const dims = await getImageDimensions(url);
      setImgDims(dims);
    } catch { /* ignore */ }
  }

  if (imageUrl && !imgDims) {
    loadDimensions(imageUrl);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const supabase = createClient();
      const path = `${userId}/photobooks/${project.id}/cover.jpg`;
      await supabase.storage.from("customer-uploads").upload(path, optimized, {
        upsert: true,
        contentType: "image/jpeg",
      });
      const { data } = await supabase.storage
        .from("customer-uploads")
        .createSignedUrl(path, 3600);
      setImagePath(path);
      setImageUrl(data?.signedUrl ?? "");
      setCrop({ x: 0, y: 0, scale: 1 });
      setImgDims(null);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
      {/* Editor */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Diseña tu portada</h2>

        {imageUrl && imgDims ? (
          <div className="relative">
            <ImageCropper
              src={imageUrl}
              imgWidth={imgDims.width}
              imgHeight={imgDims.height}
              crop={crop}
              onChange={setCrop}
            />
            {/* Title overlay in bottom margin */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center justify-center"
              style={{ height: "10%" }}
            >
              <span className="text-sm font-semibold text-gray-700 truncate px-4">
                {title || "Tu título aquí"}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition hover:bg-muted/60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Optimizando y subiendo...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <span className="font-medium">Sube tu foto de portada</span>
                <span className="text-xs">JPG, PNG — se optimiza automáticamente</span>
              </>
            )}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />

        {imageUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            Cambiar foto
          </Button>
        )}

        <div className="space-y-2">
          <Label htmlFor="cover-title">Título de portada</Label>
          <Input
            id="cover-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mi fotolibro"
            maxLength={60}
          />
        </div>

        {imageUrl && imgDims && (
          <p className="text-xs text-muted-foreground">
            Usa la rueda del ratón para hacer zoom. Arrastra para acomodar la foto.
          </p>
        )}
      </div>

      {/* Preview + save */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Vista previa</h2>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white shadow-lg">
          {/* Margin area */}
          <div className="absolute inset-[10%] overflow-hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-muted/20 text-muted-foreground text-sm">
                Tu foto aquí
              </div>
            )}
          </div>
          {/* Title in bottom margin */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center" style={{ height: "10%" }}>
            <span className="text-sm font-semibold text-gray-700 truncate px-4">
              {title}
            </span>
          </div>
          {/* Subtle border */}
          <div className="absolute inset-0 rounded-xl ring-1 ring-border" />
        </div>

        <form action={formAction}>
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="cover_image_path" value={imagePath} />
          <input type="hidden" name="cover_crop" value={JSON.stringify(crop)} />

          {state?.message && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-3">
              {state.message}
            </p>
          )}

          <Button type="submit" disabled={pending || !imageUrl} className="w-full">
            {pending ? "Guardando..." : "Guardar y continuar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
