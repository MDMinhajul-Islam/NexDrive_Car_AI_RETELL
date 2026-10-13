import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // Keep this list in sync with OPTIMIZED_HOSTS in src/lib/images.ts.
    // Photos from any other host still render, just without optimization.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // vehicle_model_images.image_url (stock model photos)
      { protocol: "https", hostname: "www.edmunds.com", pathname: "/assets/**" },
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
