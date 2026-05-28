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

  const filledPages = pages.filter((p) => p.image_url);
  const { sheets, layout } = generateSheetPlans(filledPages.length, sizeCm);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResults([]);

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
          );

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
        title,
        coverImg,
        coverCrop,
        logoImg,
      );

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
        const resp = await fetch(r.url);
        const blob = await resp.blob();
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

  // Draw crop marks only at outer edges of the page grid (not where pages meet)
  const MARK_LEN = Math.round((2 / 2.54) * PRINT_DPI);
  const GAP = Math.round((0.1 / 2.54) * PRINT_DPI);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  const occupiedCols = new Set<number>();
  const occupiedRows = new Set<number>();
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) continue;
    occupiedCols.add(i % cols);
    occupiedRows.add(Math.floor(i / cols));
  }

  // Horizontal crop marks along top and bottom edges of each row
  for (const row of occupiedRows) {
    const y0 = marginY + row * pagePx;
    const y1 = y0 + pagePx;
    for (const col of occupiedCols) {
      const xL = marginX + col * pagePx;
      const xR = xL + pagePx;

      // Left edge marks (only if this is the leftmost column)
      if (!occupiedCols.has(col - 1)) {
        // Top-left horizontal
        ctx.beginPath(); ctx.moveTo(xL - GAP - MARK_LEN, y0); ctx.lineTo(xL - GAP, y0); ctx.stroke();
        // Bottom-left horizontal
        ctx.beginPath(); ctx.moveTo(xL - GAP - MARK_LEN, y1); ctx.lineTo(xL - GAP, y1); ctx.stroke();
      }

      // Right edge marks (only if this is the rightmost column)
      if (!occupiedCols.has(col + 1)) {
        ctx.beginPath(); ctx.moveTo(xR + GAP, y0); ctx.lineTo(xR + GAP + MARK_LEN, y0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xR + GAP, y1); ctx.lineTo(xR + GAP + MARK_LEN, y1); ctx.stroke();
      }
    }

    // Top edge vertical marks (only if this is the topmost row)
    if (!occupiedRows.has(row - 1)) {
      for (const col of occupiedCols) {
        const xL = marginX + col * pagePx;
        const xR = xL + pagePx;
        ctx.beginPath(); ctx.moveTo(xL, y0 - GAP - MARK_LEN); ctx.lineTo(xL, y0 - GAP); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xR, y0 - GAP - MARK_LEN); ctx.lineTo(xR, y0 - GAP); ctx.stroke();
      }
    }

    // Bottom edge vertical marks (only if this is the bottommost row)
    const y1row = marginY + row * pagePx + pagePx;
    if (!occupiedRows.has(row + 1)) {
      for (const col of occupiedCols) {
        const xL = marginX + col * pagePx;
        const xR = xL + pagePx;
        ctx.beginPath(); ctx.moveTo(xL, y1row + GAP); ctx.lineTo(xL, y1row + GAP + MARK_LEN); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xR, y1row + GAP); ctx.lineTo(xR, y1row + GAP + MARK_LEN); ctx.stroke();
      }
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
  const spinePx = Math.round((1 / 2.54) * PRINT_DPI); // 1 cm spine
  const layoutW = pagePx + spinePx + pagePx;
  const layoutH = pagePx;

  // Decide orientation: rotate 90° if natural layout doesn't fit horizontally
  const fitsHorizontal = layoutW <= SHEET_W_PX && layoutH <= SHEET_H_PX;
  const rotate = !fitsHorizontal;

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
  if (coverImg) {
    drawBookPage(offCtx, coverImg, coverCrop, coverXOff, 0, pagePx);

    if (title) {
      offCtx.save();
      const margin = pagePx * 0.1;
      offCtx.fillStyle = "#374151";
      offCtx.font = `600 ${Math.round(margin * 0.4)}px sans-serif`;
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.fillText(title, coverXOff + pagePx / 2, layoutH - margin / 2);
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

  // Crop marks on the main canvas using the final placement rectangle
  const MARK_LEN = Math.round((2 / 2.54) * PRINT_DPI);
  const GAP = Math.round((0.1 / 2.54) * PRINT_DPI);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  const left = sheetX;
  const right = sheetX + finalW;
  const top = sheetY;
  const bottom = sheetY + finalH;

  // Outer crop marks (only at the 4 corners of the full cover sheet layout)
  // Top-left
  ctx.beginPath(); ctx.moveTo(left - GAP - MARK_LEN, top); ctx.lineTo(left - GAP, top); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left, top - GAP - MARK_LEN); ctx.lineTo(left, top - GAP); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(right + GAP, top); ctx.lineTo(right + GAP + MARK_LEN, top); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(right, top - GAP - MARK_LEN); ctx.lineTo(right, top - GAP); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(left - GAP - MARK_LEN, bottom); ctx.lineTo(left - GAP, bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left, bottom + GAP); ctx.lineTo(left, bottom + GAP + MARK_LEN); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(right + GAP, bottom); ctx.lineTo(right + GAP + MARK_LEN, bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(right, bottom + GAP); ctx.lineTo(right, bottom + GAP + MARK_LEN); ctx.stroke();

  // Fold marks at the spine edges. In natural orientation these are vertical
  // marks at x = pagePx and x = pagePx + spinePx. After rotation they become
  // horizontal marks at y offsets from the top of the layout.
  const foldOffsets = [pagePx, pagePx + spinePx];
  for (const offset of foldOffsets) {
    if (rotate) {
      // After 90° rotation, x-offset on natural layout becomes y-offset from top of placement
      const y = top + offset;
      ctx.beginPath(); ctx.moveTo(left - GAP - MARK_LEN, y); ctx.lineTo(left - GAP, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(right + GAP, y); ctx.lineTo(right + GAP + MARK_LEN, y); ctx.stroke();
    } else {
      const x = left + offset;
      ctx.beginPath(); ctx.moveTo(x, top - GAP - MARK_LEN); ctx.lineTo(x, top - GAP); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, bottom + GAP); ctx.lineTo(x, bottom + GAP + MARK_LEN); ctx.stroke();
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

