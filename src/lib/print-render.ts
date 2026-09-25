// Shared rendering primitives for the photobook print pipeline. The sheet
// generator and the admin print test both draw through here so a test page
// goes through exactly the same steps as a real sheet.

import type { CropState } from "@/lib/photobook-config";
import { embedSrgbProfile } from "@/lib/srgb-icc";

/** Reference page size the cropper works in; crops are stored in this space. */
export const REF = 400;
export const REF_CONTENT = REF * 0.8;

// 0.98 JPEG keeps the chroma close to the source after the canvas
// compositing pass. 0.95 worked but introduced subtle muting on skin /
// foliage tones; the extra ~15-20% file size on a 3900×5700 sheet is
// fine since printer-side download isn't the bottleneck.
export const SHEET_JPEG_QUALITY = 0.98;

// Render the sheets in sRGB. Display P3 was tried first to keep the full
// iPhone gamut, but a P3 file stores numerically less saturated values and
// depends on the embedded profile to look right. The print path doesn't
// honor it, so P3 sheets came out muted with reds drifting toward brown. A
// side-by-side print of both confirmed sRGB reproduces better; the <1% of
// pixels outside sRGB that get clipped is not visible on paper.
export const SHEET_COLOR_SPACE: PredefinedColorSpace = "srgb";

/**
 * Draws one book page: white background, 10% margin, the photo contained in
 * the remaining area with the customer's crop applied.
 */
export function drawBookPage(
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

/** Promise wrapper over canvas.toBlob() that rejects instead of yielding null. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      type,
      quality,
    );
  });
}

// canvas.toBlob() writes an untagged JPEG. Tag it as sRGB so the print RIP
// doesn't have to guess the color space of the file (see srgb-icc.ts).
export async function exportSheetJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  const raw = await canvasToBlob(canvas, "image/jpeg", SHEET_JPEG_QUALITY);
  return embedSrgbProfile(raw);
}
