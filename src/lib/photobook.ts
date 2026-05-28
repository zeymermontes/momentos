import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CROP, DEFAULT_SETTINGS } from "@/lib/photobook-config";
import type { CropState, PhotobookProject, PhotobookPage, PhotobookSettings } from "@/lib/photobook-config";

export type { CropState, PhotobookProject, PhotobookPage, PhotobookSettings };
export { DEFAULT_SETTINGS, getPhotobookPrice } from "@/lib/photobook-config";

export async function getPhotobookSettings(): Promise<PhotobookSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "photobook")
    .maybeSingle();
  if (!data?.value || typeof data.value !== "object") return DEFAULT_SETTINGS;
  const v = data.value as Record<string, unknown>;
  return {
    sizes: Array.isArray(v.sizes) ? v.sizes as PhotobookSettings["sizes"] : DEFAULT_SETTINGS.sizes,
    page_counts: Array.isArray(v.page_counts) ? v.page_counts as number[] : DEFAULT_SETTINGS.page_counts,
    enabled: typeof v.enabled === "boolean" ? v.enabled : true,
  };
}

function parseCrop(v: unknown): CropState {
  if (!v || typeof v !== "object") return DEFAULT_CROP;
  const c = v as Record<string, unknown>;
  return {
    x: typeof c.x === "number" ? c.x : 0,
    y: typeof c.y === "number" ? c.y : 0,
    scale: typeof c.scale === "number" ? c.scale : 1,
    rotation: typeof c.rotation === "number" ? c.rotation : 0,
  };
}

async function signUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("customer-uploads")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
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
      const [imageUrl, thumbUrl] = await Promise.all([
        signUrl(p.image_path),
        signUrl(p.thumb_path),
      ]);
      page.image_url = imageUrl;
      page.thumb_url = thumbUrl;
      return page;
    }),
  );
  return withUrls;
}

export async function getCoverUrl(project: PhotobookProject): Promise<string | null> {
  return signUrl(project.cover_image_path);
}

export async function getCoverThumbUrl(project: PhotobookProject): Promise<string | null> {
  return signUrl(project.cover_thumb_path);
}
