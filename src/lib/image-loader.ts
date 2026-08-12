/**
 * Custom `next/image` loader.
 *
 * Routing the catalog through Next's optimizer fixed the client payload but
 * moved the work onto the web server: product photos are straight off a phone
 * at 3024×4032, and decoding one costs ~47 MB of raw bitmap. On a 512 MB
 * instance, a handful of concurrent optimizations is enough to run the process
 * out of memory.
 *
 * Supabase Storage can do the same resize on its own infrastructure, so images
 * it hosts are rewritten to its render endpoint and the browser fetches them
 * directly — small bytes on the wire, nothing to decode on our box.
 *
 * Everything else is served as-is. Configuring a custom loader removes Next's
 * `/_next/image` endpoint entirely — it 404s — so falling back to it broke the
 * logo. Local files in /public are static assets the CDN already caches, and
 * they are small enough not to need resizing.
 */

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

const DEFAULT_QUALITY = 75;

type LoaderArgs = { src: string; width: number; quality?: number };

export default function supabaseImageLoader({
  src,
  width,
  quality,
}: LoaderArgs): string {
  const q = quality ?? DEFAULT_QUALITY;

  // Only public object URLs are rewritten. Signed URLs carry a token in the
  // query string and aren't served through next/image anywhere today; leaving
  // them on the fallback keeps this from silently mangling one later.
  if (src.includes(OBJECT_PATH) && !src.includes("?")) {
    // `resize=contain` is load-bearing: with `width` alone Supabase scales the
    // width and leaves the original height, which returns a stretched image
    // several times larger than it should be.
    return `${src.replace(OBJECT_PATH, RENDER_PATH)}?width=${width}&resize=contain&quality=${q}`;
  }

  return src;
}
