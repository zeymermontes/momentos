// Browser-displayable formats are passed through as-is. Re-encoding to
// WebP was clamping the wide-gamut P3 source to sRGB (the WebP encoder
// in browsers doesn't reliably preserve ICC profiles) which produced the
// "muddy / greenish skin tone" complaints on print. By preserving the
// original bytes we keep the full color profile the printer needs.
const PASSTHROUGH_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Fallback for HEIC/HEIF/AVIF that browsers can decode but the print
// pipeline + cropper can't always display. Re-encoded as high-quality
// JPEG since JPEG preserves ICC profiles better than WebP at this stage.
const FALLBACK_MAX_DIMENSION = 6000;
const FALLBACK_JPEG_QUALITY = 0.95;

const THUMB_DIMENSION = 400;
const WEBP_THUMB_QUALITY = 0.75;

const CANVAS_COLOR_SPACE: PredefinedColorSpace = "display-p3";

type OptimizedImage = {
  full: Blob;
  fullContentType: string;
  fullExtension: string;
  thumb: Blob;
};

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export async function optimizeImage(file: File): Promise<OptimizedImage> {
  // Decode once for the thumb. `colorSpaceConversion: "none"` preserves
  // the source ICC profile so wide-gamut iPhone photos stay wide-gamut.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
    colorSpaceConversion: "none",
  });

  const thumbScale = Math.min(
    1,
    THUMB_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const thumbW = Math.round(bitmap.width * thumbScale);
  const thumbH = Math.round(bitmap.height * thumbScale);

  const thumbCanvas = new OffscreenCanvas(thumbW, thumbH);
  thumbCanvas
    .getContext("2d", { colorSpace: CANVAS_COLOR_SPACE })!
    .drawImage(bitmap, 0, 0, thumbW, thumbH);
  const thumb = await thumbCanvas.convertToBlob({
    type: "image/webp",
    quality: WEBP_THUMB_QUALITY,
  });

  // Fast path: keep the original bytes verbatim. No second decode, no
  // re-encode, no color clamp. The cropper + sheet renderer can load it
  // directly since these MIME types render everywhere.
  if (PASSTHROUGH_TYPES.has(file.type)) {
    bitmap.close();
    return {
      full: file,
      fullContentType: file.type,
      fullExtension: extensionFor(file.type),
      thumb,
    };
  }

  // Slow path (HEIC, HEIF, AVIF, BMP, TIFF…). Decode + re-encode as JPEG
  // capped to 6000 px so the cropper can actually display it.
  const fullScale = Math.min(
    1,
    FALLBACK_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const fullW = Math.round(bitmap.width * fullScale);
  const fullH = Math.round(bitmap.height * fullScale);

  const fullCanvas = new OffscreenCanvas(fullW, fullH);
  fullCanvas
    .getContext("2d", { colorSpace: CANVAS_COLOR_SPACE })!
    .drawImage(bitmap, 0, 0, fullW, fullH);
  bitmap.close();
  const full = await fullCanvas.convertToBlob({
    type: "image/jpeg",
    quality: FALLBACK_JPEG_QUALITY,
  });

  return {
    full,
    fullContentType: "image/jpeg",
    fullExtension: "jpg",
    thumb,
  };
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
