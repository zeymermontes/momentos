// 6000 px lets the Xerox C70 production printer hit its sweet spot of
// ~600 PPI source on the largest fotolibros (30 cm × 80% content area
// = 24 cm needs 5670 px at 600 PPI). Smaller phones still upload fast
// since they're shrunk to their own native resolution, not padded up.
const MAX_DIMENSION = 6000;
const THUMB_DIMENSION = 400;
// WebP at 0.82 looks indistinguishable from JPEG at 0.92 in print and
// uploads ~50% smaller than the old JPEG 0.85 — the biggest single win
// for mobile upload time.
const WEBP_QUALITY = 0.82;
const WEBP_THUMB_QUALITY = 0.75;

export async function optimizeImage(
  file: File,
  maxDimension = MAX_DIMENSION,
): Promise<{ full: Blob; thumb: Blob }> {
  // `imageOrientation: "from-image"` makes the decoder apply EXIF
  // rotation so iPhone portraits don't land sideways in the canvas.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const { width, height } = bitmap;

  const fullScale = Math.min(1, maxDimension / Math.max(width, height));
  const fullW = Math.round(width * fullScale);
  const fullH = Math.round(height * fullScale);

  const fullCanvas = new OffscreenCanvas(fullW, fullH);
  fullCanvas.getContext("2d")!.drawImage(bitmap, 0, 0, fullW, fullH);

  const thumbScale = Math.min(1, THUMB_DIMENSION / Math.max(width, height));
  const thumbW = Math.round(width * thumbScale);
  const thumbH = Math.round(height * thumbScale);

  const thumbCanvas = new OffscreenCanvas(thumbW, thumbH);
  thumbCanvas.getContext("2d")!.drawImage(bitmap, 0, 0, thumbW, thumbH);
  bitmap.close();

  const [full, thumb] = await Promise.all([
    fullCanvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY }),
    thumbCanvas.convertToBlob({
      type: "image/webp",
      quality: WEBP_THUMB_QUALITY,
    }),
  ]);

  return { full, thumb };
}

export function getImageDimensions(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}
