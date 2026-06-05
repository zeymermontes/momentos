// 6000 px lets the Xerox C70 production printer hit its sweet spot of
// ~600 PPI source on the largest fotolibros (30 cm × 80% content area
// = 24 cm needs 5670 px at 600 PPI). Smaller phones still upload fast
// since they're shrunk to their own native resolution, not padded up.
const MAX_DIMENSION = 6000;
const THUMB_DIMENSION = 400;
// 0.95 keeps chroma intact (vs 0.82 which strips subtle skin/sky tones
// via 4:2:0 subsampling). Files end up ~2x bigger but print color is
// notably closer to the source. The thumb stays at 0.75 since it's only
// for UI — no print quality concern.
const WEBP_QUALITY = 0.95;
const WEBP_THUMB_QUALITY = 0.75;

// Display P3 covers ~25% more colors than sRGB and matches what iPhones
// actually capture. Working in P3 through the optimize step keeps the
// saturated greens/oranges/reds intact instead of getting "muddied" by
// being clamped into the smaller sRGB gamut.
const CANVAS_COLOR_SPACE: PredefinedColorSpace = "display-p3";

export async function optimizeImage(
  file: File,
  maxDimension = MAX_DIMENSION,
): Promise<{ full: Blob; thumb: Blob }> {
  // `imageOrientation: "from-image"` makes the decoder apply EXIF
  // rotation so iPhone portraits don't land sideways in the canvas.
  // `colorSpaceConversion: "none"` preserves the source ICC profile so we
  // can keep the wide-gamut P3 data instead of getting auto-converted to
  // sRGB at decode time.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
    colorSpaceConversion: "none",
  });
  const { width, height } = bitmap;

  const fullScale = Math.min(1, maxDimension / Math.max(width, height));
  const fullW = Math.round(width * fullScale);
  const fullH = Math.round(height * fullScale);

  const fullCanvas = new OffscreenCanvas(fullW, fullH);
  fullCanvas
    .getContext("2d", { colorSpace: CANVAS_COLOR_SPACE })!
    .drawImage(bitmap, 0, 0, fullW, fullH);

  const thumbScale = Math.min(1, THUMB_DIMENSION / Math.max(width, height));
  const thumbW = Math.round(width * thumbScale);
  const thumbH = Math.round(height * thumbScale);

  const thumbCanvas = new OffscreenCanvas(thumbW, thumbH);
  thumbCanvas
    .getContext("2d", { colorSpace: CANVAS_COLOR_SPACE })!
    .drawImage(bitmap, 0, 0, thumbW, thumbH);
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
