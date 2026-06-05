"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageCropper } from "@/components/photobook/image-cropper";
import { StepNav } from "@/components/photobook/step-nav";
import { optimizeImage, getImageDimensions } from "@/lib/image-optimize";
import { createClient } from "@/lib/supabase/client";
import { updateCoverAction, type ActionState } from "@/app/(storefront)/fotolibro/actions";
import type { CropState, PhotobookProject } from "@/lib/photobook-config";

type Props = {
  project: PhotobookProject;
  coverUrl: string | null;
  userId: string;
};

export function CoverEditor({ project, coverUrl, userId }: Props) {
  const [imagePath, setImagePath] = useState(project.cover_image_path ?? "");
  const [thumbPath, setThumbPath] = useState(project.cover_thumb_path ?? "");
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
      const fullPath = `${userId}/photobooks/${project.id}/cover_${ts}.webp`;
      const tPath = `${userId}/photobooks/${project.id}/cover_${ts}_thumb.webp`;
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.storage.from("customer-uploads").upload(fullPath, full, { contentType: "image/webp" }),
        supabase.storage.from("customer-uploads").upload(tPath, thumb, { contentType: "image/webp" }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const { data } = await supabase.storage
        .from("customer-uploads")
        .createSignedUrl(fullPath, 3600);
      const freshUrl = data?.signedUrl ?? "";
      setImagePath(fullPath);
      setThumbPath(tPath);
      setCrop({ x: 0, y: 0, scale: 1 });
      setImgDims(null);
      setImageUrl(freshUrl);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
    <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
      {/* Editor */}
      <div className="min-w-0 space-y-4">
        <h2 className="text-xl font-bold">Diseña tu portada</h2>

        {imageUrl && imgDims ? (
          <div className="relative w-full max-w-full">
            <ImageCropper
              src={imageUrl}
              imgWidth={imgDims.width}
              imgHeight={imgDims.height}
              crop={crop}
              onChange={setCrop}
              titleOverlay={title || "Tu título aquí"}
              pageSizeCm={project.size_cm}
            />
            {uploading && (
              <div className="absolute inset-0 z-40 grid place-items-center bg-white/70">
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
      <div className="min-w-0 space-y-4">
        <h2 className="text-xl font-bold">Vista previa</h2>

        <CoverPreview
          imageUrl={imageUrl}
          imgDims={imgDims}
          crop={crop}
          title={title}
        />

        <form id="cover-form" action={formAction}>
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="cover_image_path" value={imagePath} />
          <input type="hidden" name="cover_thumb_path" value={thumbPath} />
          <input type="hidden" name="cover_crop" value={JSON.stringify(crop)} />

          {state?.message && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-3">
              {state.message}
            </p>
          )}
        </form>
      </div>
    </div>

    <StepNav
      back={{ href: `/fotolibro/${project.id}/configuracion` }}
      next={{
        type: "submit",
        form: "cover-form",
        pending,
        disabled: !imageUrl,
        label: "Guardar y continuar",
      }}
    />
    </>
  );
}

const CREF = 400;
const CREF_CONTENT = CREF * 0.8;
const CREF_MARGIN = CREF * 0.1;

function CoverPreview({
  imageUrl,
  imgDims,
  crop,
  title,
}: {
  imageUrl: string;
  imgDims: { width: number; height: number } | null;
  crop: CropState;
  title: string;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState(0);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setPreviewSize(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaleDown = previewSize > 0 ? previewSize / CREF : 0;

  let containW = CREF_CONTENT;
  let containH = CREF_CONTENT;
  if (imgDims) {
    const aspect = imgDims.width / imgDims.height;
    containW = aspect >= 1 ? CREF_CONTENT : CREF_CONTENT * aspect;
    containH = aspect >= 1 ? CREF_CONTENT / aspect : CREF_CONTENT;
  }

  return (
    <div
      ref={previewRef}
      className="relative aspect-square w-full max-w-full overflow-hidden bg-white shadow-lg"
    >
      {scaleDown > 0 && (
        <div
          style={{
            width: CREF,
            height: CREF,
            transform: `scale(${scaleDown})`,
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          {imageUrl && imgDims ? (
            <div
              className="absolute overflow-hidden"
              style={{ top: CREF_MARGIN, left: CREF_MARGIN, width: CREF_CONTENT, height: CREF_CONTENT }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="absolute select-none"
                style={{
                  width: containW,
                  height: "auto",
                  aspectRatio: `${imgDims.width} / ${imgDims.height}`,
                  left: (CREF_CONTENT - containW) / 2,
                  top: (CREF_CONTENT - containH) / 2,
                  transformOrigin: "center center",
                  transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${crop.rotation ?? 0}deg)`,
                }}
              />
            </div>
          ) : (
            <div
              className="absolute grid place-items-center bg-muted/20 text-muted-foreground text-sm"
              style={{ top: CREF_MARGIN, left: CREF_MARGIN, width: CREF_CONTENT, height: CREF_CONTENT }}
            >
              Tu foto aquí
            </div>
          )}
          <div
            className="absolute left-0 right-0 flex items-center justify-center"
            style={{ bottom: 0, height: CREF_MARGIN }}
          >
            <span className="text-sm font-semibold text-gray-700 truncate px-4">
              {title || "Tu título aquí"}
            </span>
          </div>
        </div>
      )}
      <div className="absolute inset-0 ring-1 ring-border" />
    </div>
  );
}
