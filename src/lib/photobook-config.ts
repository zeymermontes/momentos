export type CropState = {
  x: number;
  y: number;
  scale: number;
  rotation?: number;
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
  price_per_page: number;
  hardcover_price: number;
};

export type PhotobookSettings = {
  sizes: PhotobookSize[];
  page_counts: number[];
  enabled: boolean;
};

export const DEFAULT_SETTINGS: PhotobookSettings = {
  sizes: [
    { cm: 15, label: "Pequeño", sublabel: "15 × 15 cm", price_per_page: 8, hardcover_price: 80 },
    { cm: 20, label: "Mediano", sublabel: "20 × 20 cm", price_per_page: 10, hardcover_price: 120 },
    { cm: 30, label: "Grande", sublabel: "30 × 30 cm", price_per_page: 15, hardcover_price: 180 },
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
  const perPage = size?.price_per_page ?? 10;
  const base = perPage * pageCount;
  return hardcover ? base + (size?.hardcover_price ?? 100) : base;
}

export const DEFAULT_CROP: CropState = { x: 0, y: 0, scale: 1, rotation: 0 };
