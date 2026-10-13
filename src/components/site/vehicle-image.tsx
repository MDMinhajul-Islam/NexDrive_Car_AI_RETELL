"use client";

import Image from "next/image";
import { useState } from "react";
import { bodyTypeFallbackImage, canOptimizeImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * next/image wrapper for vehicle photos. Stock model photos come from third-party
 * hosts, so an image that fails to load falls back to the body-type photo.
 */
export function VehicleImage({
  src,
  alt,
  bodyType,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  bodyType?: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallback = bodyTypeFallbackImage(bodyType);
  const current = failedSrc === src ? fallback : src;

  return (
    <Image
      src={current}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!canOptimizeImage(current)}
      onError={() => {
        if (current !== fallback) setFailedSrc(src);
      }}
      className={cn("object-cover", className)}
    />
  );
}
