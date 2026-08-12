import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Supabase-hosted images resize on Supabase's side instead of ours — see
    // src/lib/image-loader.ts for why the web server must not decode them.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // Default tops out at 3840, but nothing here renders wider than the
    // full-bleed hero and the source photos are 3024 px, so the largest
    // buckets only bought upscaled variants and extra cache entries.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Only the loader's fallback path (local /public assets) reaches Next's
    // optimizer now, but these stay so that path keeps working if a remote
    // image is ever pointed at it.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
