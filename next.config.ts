import type { NextConfig } from "next";
import imageHosts from "./image-hosts.json";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // `next dev` and `next build` both write to this folder. Running a build while the dev
  // server is up corrupts the dev server's files and it starts answering 404 or 500 for
  // routes such as /icon.svg. `npm run build:check` sets NEXT_DIST_DIR so a verification
  // build never touches the dev server's .next folder. Docker and Dokploy use the default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-contained server bundle in .next/standalone for the Docker image.
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    // Third-party hosts live in image-hosts.json (shared with src/lib/images.ts).
    // Photos from any host not listed there still render, just without optimization.
    remotePatterns: [
      ...imageHosts.hosts.map((hostname) => ({ protocol: "https" as const, hostname })),
      // Supabase Storage: public vehicle-images bucket
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/vehicle-images/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
