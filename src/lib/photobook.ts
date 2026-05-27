import { createClient } from "@/lib/supabase/server";

export type CropState = {
  x: number;
  y: number;
  scale: number;
};

export type PhotobookProject = {
  id: string;
  user_id: string;
  size_cm: number;
  page_count: number;
  title: string;
  cover_image_path: string | null;
  cover_crop: CropState;
  status: string;
};

export type PhotobookPage = {
  id: string;
  project_id: string;
  sort_order: number;
  image_path: string | null;
  crop: CropState;
  image_url?: string | null;
};

export const SIZES = [
  { cm: 15, label: "Pequeño", sublabel: "15 × 15 cm" },
  { cm: 20, label: "Mediano", sublabel: "20 × 20 cm" },
  { cm: 30, label: "Grande", sublabel: "30 × 30 cm" },
] as const;

export const PAGE_COUNTS = [20, 40, 60] as const;

const DEFAULT_CROP: CropState = { x: 0, y: 0, scale: 1 };

function parseCrop(v: unknown): CropState {
  if (!v || typeof v !== "object") return DEFAULT_CROP;
  const c = v as Record<string, unknown>;
  return {
    x: typeof c.x === "number" ? c.x : 0,
    y: typeof c.y === "number" ? c.y : 0,
    scale: typeof c.scale === "number" ? c.scale : 1,
  };
}

export async function getProject(projectId: string): Promise<PhotobookProject | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("photobook_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, cover_crop: parseCrop(data.cover_crop) } as PhotobookProject;
}

export async function getProjectPages(projectId: string): Promise<PhotobookPage[]> {
  const supabase = await createClient();
  const { data: pages } = await supabase
    .from("photobook_pages")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!pages || pages.length === 0) return [];

  const withUrls = await Promise.all(
    (pages as unknown as PhotobookPage[]).map(async (p) => {
      const page: PhotobookPage = { ...p, crop: parseCrop(p.crop) };
      if (p.image_path) {
        const { data } = await supabase.storage
          .from("customer-uploads")
          .createSignedUrl(p.image_path, 3600);
        page.image_url = data?.signedUrl ?? null;
      }
      return page;
    }),
  );
  return withUrls;
}

export async function getCoverUrl(project: PhotobookProject): Promise<string | null> {
  if (!project.cover_image_path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("customer-uploads")
    .createSignedUrl(project.cover_image_path, 3600);
  return data?.signedUrl ?? null;
}
