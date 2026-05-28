"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/photobook/image-cropper";
import { PagePreview } from "@/components/photobook/page-preview";
import { optimizeImage, getImageDimensions } from "@/lib/image-optimize";
import { createClient } from "@/lib/supabase/client";
import {
  updatePageCropAction,
  assignImageToPageAction,
} from "@/app/(storefront)/fotolibro/actions";
import type { CropState, PhotobookPage } from "@/lib/photobook-config";

type Props = {
  projectId: string;
  page: PhotobookPage;
  userId: string;
};

export function PageEditor({ projectId, page, userId }: Props) {
  const router = useRouter();
  const [crop, setCrop] = useState<CropState>(page.crop);
  const [imageUrl, setImageUrl] = useState(page.image_url ?? "");
  const [, setImagePath] = useState(page.image_path ?? "");
  const [imgDims, setImgDims] = useState<{ width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    getImageDimensions(imageUrl).then((dims) => {
      if (!cancelled) setImgDims(dims);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [imageUrl]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { full, thumb } = await optimizeImage(file);
      const supabase = createClient();
      const ts = Date.now();
      const fullPath = `${userId}/photobooks/${projectId}/pages/${String(page.sort_order).padStart(3, "0")}_${ts}.webp`;
      const tPath = `${userId}/photobooks/${projectId}/pages/${String(page.sort_order).padStart(3, "0")}_${ts}_thumb.webp`;
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.storage.from("customer-uploads").upload(fullPath, full, { contentType: "image/webp" }),
        supabase.storage.from("customer-uploads").upload(tPath, thumb, { contentType: "image/webp" }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const { data } = await supabase.storage
        .from("customer-uploads")
        .createSignedUrl(fullPath, 3600);

      setImagePath(fullPath);
      setImageUrl(data?.signedUrl ?? "");
      setCrop({ x: 0, y: 0, scale: 1, rotation: 0 });
      setImgDims(null);

      startTransition(async () => {
        await assignImageToPageAction(projectId, page.id, fullPath, tPath);
      });
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      await updatePageCropAction(projectId, page.id, crop);
      router.push(`/fotolibro/${projectId}/paginas`);
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
      {/* Editor */}
      <div className="min-w-0 space-y-4">
        <h2 className="text-xl font-bold">Editar página {page.sort_order}</h2>

        {imageUrl && imgDims ? (
          <div className="relative w-full max-w-full">
            <ImageCropper
              src={imageUrl}
              imgWidth={imgDims.width}
              imgHeight={imgDims.height}
              crop={crop}
              onChange={setCrop}
            />
            {uploading && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-white/70">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Subiendo nueva foto...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition hover:bg-muted/60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Subiendo...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <span className="font-medium">Sube una foto para esta página</span>
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
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              "Cambiar foto"
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Usa la rueda del ratón para hacer zoom. Arrastra para acomodar la foto.
        </p>
      </div>

      {/* Preview + save */}
      <div className="min-w-0 space-y-4">
        <h2 className="text-xl font-bold">Vista previa</h2>

        <PagePreview
          imageUrl={imageUrl}
          imgDims={imgDims}
          crop={crop}
          pageNum={page.sort_order}
        />

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={isPending || !imageUrl}
            className="flex-1"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
