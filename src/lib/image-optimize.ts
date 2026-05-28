const MAX_DIMENSION = 4096;
const THUMB_DIMENSION = 400;
const JPEG_QUALITY = 0.85;
const WEBP_QUALITY = 0.75;

export async function optimizeImage(
  file: File,
  maxDimension = MAX_DIMENSION,
): Promise<{ full: Blob; thumb: Blob }> {
  const bitmap = await createImageBitmap(file);
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
    fullCanvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY }),
    thumbCanvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY }),
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
