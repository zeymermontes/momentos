import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CROP, DEFAULT_SETTINGS } from "@/lib/photobook-config";
import type { CropState, PhotobookProject, PhotobookPage, PhotobookSettings, PhotobookSize } from "@/lib/photobook-config";

export type { CropState, PhotobookProject, PhotobookPage, PhotobookSettings };
export { DEFAULT_SETTINGS, getPhotobookPrice } from "@/lib/photobook-config";

/**
 * Normalize a stored size row. `supports_hardcover` was added later, so
 * old settings JSONB may not have the field — default to `true` to
 * preserve the historical behavior (all sizes offered pasta dura).
 */
function normalizeSize(raw: unknown): PhotobookSize | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.cm !== "number") return null;
  return {
    cm: s.cm,
    label: typeof s.label === "string" ? s.label : "",
    sublabel: typeof s.sublabel === "string" ? s.sublabel : "",
    supports_hardcover:
      typeof s.supports_hardcover === "boolean" ? s.supports_hardcover : true,
    hardcover_price:
      typeof s.hardcover_price === "number" ? s.hardcover_price : 0,
    prices:
      s.prices && typeof s.prices === "object"
        ? (s.prices as Record<number, number>)
        : {},
  };
}

export async function getPhotobookSettings(): Promise<PhotobookSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "photobook")
    .maybeSingle();
  if (!data?.value || typeof data.value !== "object") return DEFAULT_SETTINGS;
  const v = data.value as Record<string, unknown>;
  const sizes = Array.isArray(v.sizes)
    ? v.sizes.map(normalizeSize).filter((s): s is PhotobookSize => s !== null)
    : DEFAULT_SETTINGS.sizes;
  return {
    sizes: sizes.length > 0 ? sizes : DEFAULT_SETTINGS.sizes,
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

// Module-level cache of signed storage URLs so navigating across the
// photobook steps reuses the same URL — the browser can then cache the
// image bytes across pages instead of re-downloading. Sign for 24h and
// re-sign 30min before expiry to avoid serving a URL that will fail
// halfway through the user's session.
const SIGN_TTL_SECONDS = 24 * 60 * 60;
const SIGN_GRACE_MS = 30 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function signUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > now + SIGN_GRACE_MS) {
    return cached.url;
  }
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("customer-uploads")
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (!data?.signedUrl) return null;
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: now + SIGN_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

export async function getProject(projectId: string): Promise<PhotobookProject | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("photobook_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    cover_crop: parseCrop(data.cover_crop),
    print_sheets: Array.isArray(data.print_sheets) ? data.print_sheets : null,
  } as PhotobookProject;
}

export async function getPrintSheetUrls(
  sheets: { side: "front" | "back" | "cover"; index: number; path: string }[],
): Promise<{ side: "front" | "back" | "cover"; index: number; url: string; storagePath: string }[]> {
  const out = [];
  for (const s of sheets) {
    const url = await signUrl(s.path);
    out.push({ side: s.side, index: s.index, url: url ?? "", storagePath: s.path });
  }
  return out;
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
