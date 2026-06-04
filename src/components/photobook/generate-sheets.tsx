"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Download, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SHEET_W_PX,
  SHEET_H_PX,
  PRINT_DPI,
  generateSheetPlans,
  type SheetLayout,
} from "@/lib/print-sheets";
import type { PhotobookPage } from "@/lib/photobook-config";
import type { CropState } from "@/lib/photobook-config";
import { createClient } from "@/lib/supabase/client";
import { savePrintSheetsAction } from "@/app/(storefront)/fotolibro/actions";

const REF = 400;
const REF_CONTENT = REF * 0.8;

type Props = {
  projectId: string;
  sizeCm: number;
  pages: PhotobookPage[];
  userId: string;
  title: string;
  coverImageUrl: string | null;
  coverCrop: CropState;
  existingSheets?: SheetResult[];
  /** When true, auto-trigger generation on mount if there are no existing sheets. */
  autoGenerate?: boolean;
};

type SheetResult = {
  index: number;
  side: "front" | "back" | "cover";
  url: string;
  storagePath: string;
};

export function GenerateSheets({ projectId, sizeCm, pages, userId, title, coverImageUrl, coverCrop, existingSheets, autoGenerate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<SheetResult[]>(existingSheets ?? []);
  const [error, setError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const autoStartedRef = useRef(false);
  // In-memory cache of the blobs we just generated this session, keyed by
  // `${side}-${index}`. Lets the "Descargar todo" button zip without
  // re-downloading from storage right after generating.
  const blobCacheRef = useRef<Map<string, Blob>>(new Map());

  const filledPages = pages.filter((p) => p.image_url);
  const { sheets, layout } = generateSheetPlans(filledPages.length, sizeCm);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResults([]);
    blobCacheRef.current = new Map();

    try {
      setProgress("Cargando imágenes...");
      const imageMap = new Map<number, HTMLImageElement>();
      await Promise.all(
        filledPages.map(
          (p, i) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                imageMap.set(i + 1, img);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = p.image_url!;
            }),
        ),
      );

      const supabase = createClient();
      const allResults: SheetResult[] = [];

      for (let si = 0; si < sheets.length; si++) {
        const sheet = sheets[si];
        for (const side of ["front", "back"] as const) {
          const slots = side === "front" ? sheet.front : sheet.back;
          setProgress(
            `Generando hoja ${si + 1}/${sheets.length} (${side === "front" ? "frente" : "reverso"})...`,
          );

          const blob = await renderSheet(
            slots,
            layout,
            filledPages,
            imageMap,
            side,
          );
          blobCacheRef.current.set(`${side}-${si}`, blob);

          const path = `${userId}/photobooks/${projectId}/sheets/sheet_${si + 1}_${side}.jpg`;
          setProgress(
            `Subiendo hoja ${si + 1}/${sheets.length} (${side === "front" ? "frente" : "reverso"})...`,
          );

          const { error: upErr } = await supabase.storage
            .from("customer-uploads")
            .upload(path, blob, { contentType: "image/jpeg", upsert: true });

          if (upErr) {
            // Try without upsert (no update policy)
            const pathAlt = `${userId}/photobooks/${projectId}/sheets/sheet_${si + 1}_${side}_${Date.now()}.jpg`;
            const { error: upErr2 } = await supabase.storage
              .from("customer-uploads")
              .upload(pathAlt, blob, { contentType: "image/jpeg" });
            if (upErr2) throw upErr2;

            const { data: signed } = await supabase.storage
              .from("customer-uploads")
              .createSignedUrl(pathAlt, 86400);
            allResults.push({
              index: si,
              side,
              url: signed?.signedUrl ?? "",
              storagePath: pathAlt,
            });
          } else {
            const { data: signed } = await supabase.storage
              .from("customer-uploads")
              .createSignedUrl(path, 86400);
            allResults.push({
              index: si,
              side,
              url: signed?.signedUrl ?? "",
              storagePath: path,
            });
          }
        }
      }

      // Generate cover sheet (back + spine + cover on one sheet)
      setProgress("Generando hoja de portada...");
      let coverImg: HTMLImageElement | null = null;
      if (coverImageUrl) {
        coverImg = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = coverImageUrl;
        });
      }

      // Load the black Momentos logo for the back cover
      const logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "/momentos-logo.png";
      });

      const coverBlob = await renderCoverSheet(
        sizeCm,
        pages.length,
        title,
        coverImg,
        coverCrop,
        logoImg,
      );
      blobCacheRef.current.set("cover--1", coverBlob);

      setProgress("Subiendo hoja de portada...");
      const coverPath = `${userId}/photobooks/${projectId}/sheets/cover_${Date.now()}.jpg`;
      const { error: coverUpErr } = await supabase.storage
        .from("customer-uploads")
        .upload(coverPath, coverBlob, { contentType: "image/jpeg" });
      if (coverUpErr) throw coverUpErr;

      const { data: coverSigned } = await supabase.storage
        .from("customer-uploads")
        .createSignedUrl(coverPath, 86400);
      allResults.push({
        index: -1,
        side: "cover",
        url: coverSigned?.signedUrl ?? "",
        storagePath: coverPath,
      });

      setResults(allResults);
      setProgress("Guardando...");
      await savePrintSheetsAction(
        projectId,
        allResults.map((r) => ({ side: r.side, index: r.index, path: r.storagePath })),
      );
      setProgress("¡Listo!");
    } catch (e) {
      console.error("Sheet generation failed:", e);
      setError(e instanceof Error ? e.message : "Error al generar hojas");
    } finally {
      setGenerating(false);
    }
  }

  const filledCount = pages.filter((p) => p.image_url).length;

  useEffect(() => {
    if (!autoGenerate) return;
    if (autoStartedRef.current) return;
    if ((existingSheets?.length ?? 0) > 0) return;
    if (filledCount === 0) return;
    autoStartedRef.current = true;
    setAutoTriggered(true);
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, existingSheets, filledCount]);

  async function handleDownloadAll() {
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      for (const r of results) {
        // Prefer the in-memory blob (just generated) to avoid a roundtrip
        // through storage; fall back to fetching the signed URL.
        const cached = blobCacheRef.current.get(`${r.side}-${r.index}`);
        const blob = cached ?? (await (await fetch(r.url)).blob());
        const name = r.side === "cover"
          ? "portada_contraportada.jpg"
          : `hoja_${r.index + 1}_${r.side === "front" ? "frente" : "reverso"}.jpg`;
        zip.file(name, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fotolibro_${projectId.slice(0, 8)}_impresion.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Hojas de impresión</h3>
          <p className="text-sm text-muted-foreground">
            {filledPages.length} páginas → {sheets.length} hoja{sheets.length !== 1 ? "s" : ""} de 13&quot;×19&quot;
            ({layout.cols}×{layout.rows} = {layout.pagesPerSide} páginas/lado) · 300 DPI
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || filledPages.length === 0}
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <FileImage className="mr-2 h-4 w-4" />
              Generar hojas
            </>
          )}
        </Button>
      </div>

      {progress && generating && (
        <div className={
          autoTriggered
            ? "rounded-md border border-primary/20 bg-primary/5 p-3 text-sm"
            : "text-sm text-muted-foreground"
        }>
          {autoTriggered && (
            <p className="font-medium text-primary mb-1">
              Generando hojas de impresión automáticamente (pedido pagado)
            </p>
          )}
          <p className={autoTriggered ? "text-muted-foreground" : ""}>{progress}</p>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {results.length} archivos generados
            </p>
            <Button variant="outline" size="sm" onClick={handleDownloadAll} disabled={zipping}>
              {zipping ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {zipping ? "Preparando ZIP..." : "Descargar ZIP"}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((r) => (
              <a
                key={`${r.index}-${r.side}`}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md border border-border p-3 text-sm hover:bg-muted/40 transition"
              >
                <FileImage className="h-4 w-4 text-primary shrink-0" />
                <span className="flex-1 truncate">
                  {r.side === "cover"
                    ? "Portada y contraportada"
                    : `Hoja ${r.index + 1} — ${r.side === "front" ? "Frente" : "Reverso"}`}
                </span>
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function renderSheet(
  slots: (number | null)[],
  layout: SheetLayout,
  pages: PhotobookPage[],
  imageMap: Map<number, HTMLImageElement>,
  side: "front" | "back",
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SHEET_W_PX;
  canvas.height = SHEET_H_PX;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_W_PX, SHEET_H_PX);

  const { pagePx, cols, marginX, marginY } = layout;

  for (let i = 0; i < slots.length; i++) {
    const pageNum = slots[i];
    if (!pageNum) continue;

    const page = pages[pageNum - 1];
    if (!page) continue;

    const img = imageMap.get(pageNum);
    if (!img) continue;

    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * pagePx;
    const y = marginY + row * pagePx;

    drawBookPage(ctx, img, page.crop, x, y, pagePx);
  }

  // Crop marks only on the front side — the back is plain so the printed
  // photo doesn't get marred on both sides. Front marks are enough for the
  // cutter to align both sides since front/back are registered.
  if (side === "back") {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.95,
      );
    });
  }

  // L-shaped crop marks at every page corner, pointing INTO the page area.
  // Skip corners where 4 pages meet — those don't need a guide because all
  // 4 adjacent pages already cluster a cut indicator there.
  const MARK_LEN = Math.round((0.5 / 2.54) * PRINT_DPI);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  const occupied = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    occupied.add(`${col},${row}`);
  }

  // True when the grid intersection at (gx, gy) is surrounded by occupied
  // pages on all four sides (a 4-way junction).
  const isFourWayJunction = (gx: number, gy: number) =>
    occupied.has(`${gx - 1},${gy - 1}`) &&
    occupied.has(`${gx},${gy - 1}`) &&
    occupied.has(`${gx - 1},${gy}`) &&
    occupied.has(`${gx},${gy}`);

  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const xL = marginX + col * pagePx;
    const xR = xL + pagePx;
    const yT = marginY + row * pagePx;
    const yB = yT + pagePx;

    // Top-left corner — grid intersection (col, row)
    if (!isFourWayJunction(col, row)) {
      ctx.beginPath(); ctx.moveTo(xL, yT); ctx.lineTo(xL + MARK_LEN, yT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xL, yT); ctx.lineTo(xL, yT + MARK_LEN); ctx.stroke();
    }
    // Top-right corner — grid intersection (col + 1, row)
    if (!isFourWayJunction(col + 1, row)) {
      ctx.beginPath(); ctx.moveTo(xR, yT); ctx.lineTo(xR - MARK_LEN, yT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xR, yT); ctx.lineTo(xR, yT + MARK_LEN); ctx.stroke();
    }
    // Bottom-left corner — grid intersection (col, row + 1)
    if (!isFourWayJunction(col, row + 1)) {
      ctx.beginPath(); ctx.moveTo(xL, yB); ctx.lineTo(xL + MARK_LEN, yB); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xL, yB); ctx.lineTo(xL, yB - MARK_LEN); ctx.stroke();
    }
    // Bottom-right corner — grid intersection (col + 1, row + 1)
    if (!isFourWayJunction(col + 1, row + 1)) {
      ctx.beginPath(); ctx.moveTo(xR, yB); ctx.lineTo(xR - MARK_LEN, yB); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xR, yB); ctx.lineTo(xR, yB - MARK_LEN); ctx.stroke();
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.95,
    );
  });
}

function drawBookPage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  crop: CropState,
  x: number,
  y: number,
  pagePx: number,
) {
  const scale = pagePx / REF;
  const margin = pagePx * 0.1;
  const contentPx = pagePx * 0.8;

  // White page background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, pagePx, pagePx);

  // Clip to content area
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + margin, y + margin, contentPx, contentPx);
  ctx.clip();

  // Calculate contain dimensions in REF space
  const aspect = img.naturalWidth / img.naturalHeight;
  const isLandscape = aspect >= 1;
  const containW = isLandscape ? REF_CONTENT : REF_CONTENT * aspect;
  const containH = isLandscape ? REF_CONTENT / aspect : REF_CONTENT;

  // Position the image: translate to content center, apply crop transforms
  const imgCenterX = x + margin + (REF_CONTENT - containW) / 2 * scale + containW / 2 * scale;
  const imgCenterY = y + margin + (REF_CONTENT - containH) / 2 * scale + containH / 2 * scale;

  ctx.translate(imgCenterX + crop.x * scale, imgCenterY + crop.y * scale);
  ctx.scale(crop.scale, crop.scale);
  ctx.rotate(((crop.rotation ?? 0) * Math.PI) / 180);

  const drawW = containW * scale;
  const drawH = containH * scale;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  ctx.restore();
}


async function renderCoverSheet(
  sizeCm: number,
  pageCount: number,
  title: string,
  coverImg: HTMLImageElement | null,
  coverCrop: CropState,
  logoImg: HTMLImageElement | null,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SHEET_W_PX;
  canvas.height = SHEET_H_PX;
  const ctx = canvas.getContext("2d")!;

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_W_PX, SHEET_H_PX);

  const pagePx = Math.round((sizeCm / 2.54) * PRINT_DPI);
  // Thin books (< 65 pages) get a 0.5 cm spine; thicker books need 1 cm so
  // the rotated title fits comfortably and the fold has enough material.
  const spineCm = pageCount < 65 ? 0.5 : 1;
  const spinePx = Math.round((spineCm / 2.54) * PRINT_DPI);
  // 0.5 cm in pixels, used to inset the cover image, shift it toward the
  // spine, and nudge the title higher.
  const halfCmPx = Math.round((0.5 / 2.54) * PRINT_DPI);
  const layoutW = pagePx + spinePx + pagePx;
  const layoutH = pagePx;

  // Always prefer rotating so the long dimension of the cover (back + spine +
  // front) aligns with the long dimension of the sheet (19"). This gives the
  // most room and avoids tight fits for larger photobook sizes. Fall back to
  // the natural horizontal layout only if the rotated layout doesn't fit.
  const fitsRotated = layoutW <= SHEET_H_PX && layoutH <= SHEET_W_PX;
  const fitsHorizontal = layoutW <= SHEET_W_PX && layoutH <= SHEET_H_PX;
  const rotate = fitsRotated || !fitsHorizontal;

  // Render the cover content to an offscreen canvas in natural orientation,
  // then paste it onto the sheet (rotated or not).
  const off = document.createElement("canvas");
  off.width = layoutW;
  off.height = layoutH;
  const offCtx = off.getContext("2d")!;

  // White layout background
  offCtx.fillStyle = "#ffffff";
  offCtx.fillRect(0, 0, layoutW, layoutH);

  const backX = 0;
  const spineX = pagePx;
  const coverXOff = pagePx + spinePx;

  // --- Back cover (left): white with black Momentos logo ---
  if (logoImg) {
    const fiveCmPx = Math.round((5 / 2.54) * PRINT_DPI);
    const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
    let logoW: number;
    let logoH: number;
    if (logoAspect >= 1) {
      logoW = fiveCmPx;
      logoH = fiveCmPx / logoAspect;
    } else {
      logoH = fiveCmPx;
      logoW = fiveCmPx * logoAspect;
    }
    const logoBottomOffset = Math.round((5 / 2.54) * PRINT_DPI);
    const logoX = backX + (pagePx - logoW) / 2;
    const logoY = layoutH - logoBottomOffset - logoH;

    const logoOff = document.createElement("canvas");
    logoOff.width = Math.round(logoW);
    logoOff.height = Math.round(logoH);
    const logoCtx = logoOff.getContext("2d")!;
    logoCtx.drawImage(logoImg, 0, 0, logoOff.width, logoOff.height);
    logoCtx.globalCompositeOperation = "source-in";
    logoCtx.fillStyle = "#000000";
    logoCtx.fillRect(0, 0, logoOff.width, logoOff.height);
    offCtx.drawImage(logoOff, logoX, logoY);
  }

  // --- Spine: title rotated 90deg, centered ---
  if (title) {
    offCtx.save();
    offCtx.translate(spineX + spinePx / 2, layoutH / 2);
    offCtx.rotate(-Math.PI / 2);
    offCtx.fillStyle = "#000000";
    offCtx.font = `bold ${Math.round(spinePx * 0.4)}px sans-serif`;
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    offCtx.fillText(title, 0, 0);
    offCtx.restore();
  }

  // --- Cover (right): user image with crop ---
  // The visible cover is 0.5 cm smaller on each side (so 1 cm narrower /
  // shorter overall) AND shifted 0.5 cm toward the spine. The 0.5 cm
  // top/bottom/far-side insets cancel naturally with the 0.5 cm leftward
  // shift, leaving the spine-side edge sitting on the spine boundary.
  const coverDrawPx = pagePx - 2 * halfCmPx;
  const coverDrawX = coverXOff; // = (coverXOff + halfCmPx) - halfCmPx
  const coverDrawY = halfCmPx;

  if (coverImg) {
    drawBookPage(offCtx, coverImg, coverCrop, coverDrawX, coverDrawY, coverDrawPx);

    if (title) {
      offCtx.save();
      const margin = pagePx * 0.1;
      offCtx.fillStyle = "#374151";
      offCtx.font = `600 ${Math.round(margin * 0.4)}px sans-serif`;
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      // Centered horizontally under the shifted cover and 0.5 cm above
      // the original baseline so the title doesn't crowd the bottom edge.
      offCtx.fillText(
        title,
        coverDrawX + coverDrawPx / 2,
        layoutH - margin / 2 - halfCmPx,
      );
      offCtx.restore();
    }
  }

  // Composite onto main sheet (rotated if necessary)
  const finalW = rotate ? layoutH : layoutW;
  const finalH = rotate ? layoutW : layoutH;
  const sheetX = Math.round((SHEET_W_PX - finalW) / 2);
  const sheetY = Math.round((SHEET_H_PX - finalH) / 2);

  if (rotate) {
    ctx.save();
    ctx.translate(sheetX + finalW / 2, sheetY + finalH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(off, -layoutW / 2, -layoutH / 2);
    ctx.restore();
  } else {
    ctx.drawImage(off, sheetX, sheetY);
  }

  // Single continuous border around the full piece (back + spine + cover) so
  // the printer sees one rectangle to cut. We intentionally do NOT draw fold
  // marks at the spine edges — the spine is part of the same rectangle.
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  const left = sheetX;
  const right = sheetX + finalW;
  const top = sheetY;
  const bottom = sheetY + finalH;

  ctx.strokeRect(left, top, right - left, bottom - top);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.95,
    );
  });
}

