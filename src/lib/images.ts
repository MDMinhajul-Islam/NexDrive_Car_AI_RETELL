import imageHosts from "../../image-hosts.json";
import { SUPABASE_URL } from "@/lib/env";
import { VEHICLE_IMAGE_BUCKET } from "@/lib/constants";

const unsplash = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const SITE_IMAGES = {
  hero: unsplash("1503376780353-7e6692767b70", 2400),
  cta: unsplash("1568605117036-5fe5e7bab0b7", 2400),
  about: unsplash("1486006920555-c77dcf18193c", 2000),
  showroom: unsplash("1617788138017-80ad40651399", 1600),
  og: unsplash("1503376780353-7e6692767b70", 1200),
} as const;

/** Last-resort image per body type, used when a vehicle has no photo of its own. */
const BODY_TYPE_FALLBACKS: Record<string, string> = {
  SUV: unsplash("1533473359331-0135ef1b58bf"),
  Sedan: unsplash("1555215695-3004980ad54e"),
  Truck: unsplash("1559416523-140ddc3d238c"),
  Hatchback: unsplash("1541899481282-d53bffe3c35d"),
  Coupe: unsplash("1580273916550-e323be2ae537"),
  Convertible: unsplash("1605559424843-9e4c228bf1c2"),
  Wagon: unsplash("1606664515524-ed2f786a0bd6"),
  Minivan: unsplash("1519641471654-76ce0107ad1b"),
  Van: unsplash("1519641471654-76ce0107ad1b"),
};
const DEFAULT_FALLBACK = unsplash("1502877338535-766e1452684a");

export function bodyTypeFallbackImage(bodyType: string | null | undefined) {
  return (bodyType && BODY_TYPE_FALLBACKS[bodyType]) || DEFAULT_FALLBACK;
}

/** vehicle_model_images.image_key format: lower(make)|lower(model) */
export function modelImageKey(make: string, model: string) {
  return `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}`;
}

/** Public URL for a vehicle_images.storage_path in the public vehicle-images bucket. */
export function storageImageUrl(storagePath: string) {
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${VEHICLE_IMAGE_BUCKET}/${path}`;
}

/**
 * Hosts configured in next.config.ts `images.remotePatterns` (from image-hosts.json).
 * Anything else is rendered unoptimized so an unknown host can never break a page.
 */
const EXACT_HOSTS = new Set<string>([
  ...imageHosts.hosts.filter((h) => !h.startsWith("*.")),
  safeHost(SUPABASE_URL),
]);
const WILDCARD_SUFFIXES = imageHosts.hosts.filter((h) => h.startsWith("*.")).map((h) => h.slice(1));

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function canOptimizeImage(src: string) {
  const host = safeHost(src);
  if (!host) return false;
  if (EXACT_HOSTS.has(host)) return true;
  // "*.example.com" matches exactly one extra label, like next/image does.
  return WILDCARD_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && !host.slice(0, -suffix.length).includes("."),
  );
}
