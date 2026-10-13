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
