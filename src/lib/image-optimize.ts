const MAX_DIMENSION = 4096;
const JPEG_QUALITY = 0.85;

export async function optimizeImage(
  file: File,
  maxDimension = MAX_DIMENSION,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);

  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
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
