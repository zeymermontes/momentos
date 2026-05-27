"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/photobook/image-cropper";
import { optimizeImage, getImageDimensions } from "@/lib/image-optimize";
import { createClient } from "@/lib/supabase/client";
import {
  updatePageCropAction,
  assignImageToPageAction,
} from "@/app/(storefront)/fotolibro/actions";
import type { CropState, PhotobookPage } from "@/lib/photobook";

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
      const path = `${userId}/photobooks/${projectId}/pages/${String(page.sort_order).padStart(3, "0")}.jpg`;
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

      startTransition(async () => {
        await assignImageToPageAction(projectId, page.id, path);
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
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-xl font-bold">Editar página {page.sort_order}</h2>

      {imageUrl && imgDims ? (
        <ImageCropper
          src={imageUrl}
          imgWidth={imgDims.width}
          imgHeight={imgDims.height}
          crop={crop}
          onChange={setCrop}
        />
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

      <p className="text-xs text-muted-foreground">
        Usa la rueda del ratón para hacer zoom. Arrastra para acomodar la foto.
        El margen de 10% se respeta en la impresión.
      </p>

      <div className="flex gap-3">
        {imageUrl && (
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            Cambiar foto
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={isPending || !imageUrl}
          className="flex-1"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
