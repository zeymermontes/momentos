export type CropState = {
  x: number;
  y: number;
  scale: number;
  rotation?: number;
};

export type PrintSheetRef = {
  side: "front" | "back" | "cover";
  index: number;
  path: string;
};

export type PhotobookProject = {
  id: string;
  user_id: string;
  size_cm: number;
  page_count: number;
  title: string;
  cover_image_path: string | null;
  cover_thumb_path: string | null;
  cover_crop: CropState;
  status: string;
  print_sheets: PrintSheetRef[] | null;
};

export type PhotobookPage = {
  id: string;
  project_id: string;
  sort_order: number;
  image_path: string | null;
  thumb_path: string | null;
  crop: CropState;
  image_url?: string | null;
  thumb_url?: string | null;
};

export type PhotobookSize = {
  cm: number;
  label: string;
  sublabel: string;
  hardcover_price: number;
  /**
   * Total price in MXN for each page count option. Non-proportional —
   * each combination is set explicitly by the admin.
   */
  prices: Record<number, number>;
};

export type PhotobookSettings = {
  sizes: PhotobookSize[];
  page_counts: number[];
  enabled: boolean;
};

export const DEFAULT_SETTINGS: PhotobookSettings = {
  sizes: [
    {
      cm: 15,
      label: "Pequeño",
      sublabel: "15 × 15 cm",
      hardcover_price: 80,
      prices: { 20: 160, 40: 280, 60: 380 },
    },
    {
      cm: 20,
      label: "Mediano",
      sublabel: "20 × 20 cm",
      hardcover_price: 120,
      prices: { 20: 220, 40: 400, 60: 560 },
    },
    {
      cm: 30,
      label: "Grande",
      sublabel: "30 × 30 cm",
      hardcover_price: 180,
      prices: { 20: 320, 40: 580, 60: 820 },
    },
  ],
  page_counts: [20, 40, 60],
  enabled: true,
};

export function getPhotobookPrice(
  settings: PhotobookSettings,
  sizeCm: number,
  pageCount: number,
  hardcover = false,
): number {
  const size = settings.sizes.find((s) => s.cm === sizeCm);
  if (!size) return 0;
  const base = size.prices?.[pageCount] ?? 0;
  return hardcover ? base + (size.hardcover_price ?? 0) : base;
}

export const DEFAULT_CROP: CropState = { x: 0, y: 0, scale: 1, rotation: 0 };
