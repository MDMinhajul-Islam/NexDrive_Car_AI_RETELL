"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VehicleImage } from "@/components/site/vehicle-image";
import { cn } from "@/lib/utils";

export function Gallery({ images, alt, bodyType }: { images: string[]; alt: string; bodyType: string }) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <section aria-label="Vehicle photos" className="space-y-3">
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-neutral-100"
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        <VehicleImage
          key={images[index]}
          src={images[index]}
          alt={count > 1 ? `${alt}, photo ${index + 1} of ${count}` : alt}
          bodyType={bodyType}
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-neutral-950/70 text-white transition-colors hover:bg-neutral-950"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-neutral-950/70 text-white transition-colors hover:bg-neutral-950"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <p
              aria-live="polite"
              className="absolute bottom-3 right-3 rounded-full bg-neutral-950/70 px-3 py-1 text-xs font-medium text-white"
            >
              {index + 1} / {count}
            </p>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100 ring-2 ring-transparent transition",
                  i === index ? "ring-brand" : "opacity-70 hover:opacity-100",
                )}
              >
                <VehicleImage src={src} alt="" bodyType={bodyType} sizes="160px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
