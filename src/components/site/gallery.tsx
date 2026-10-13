"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VehicleImage } from "@/components/site/vehicle-image";
import { cn } from "@/lib/utils";

/**
 * Photo gallery. The main strip is a native horizontal scroller with scroll snapping,
 * so it swipes with a finger on touch screens and works with the arrow buttons, the
 * keyboard and the thumbnails everywhere else.
 */
export function Gallery({ images, alt, bodyType }: { images: string[]; alt: string; bodyType: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const scrollTo = useCallback(
    (next: number) => {
      const el = strip.current;
      if (!el) return;
      const target = (next + count) % count;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: target * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    },
    [count],
  );

  // Keep the counter and thumbnails in sync with swipes.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el.clientWidth > 0) setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [count]);

  return (
    <section aria-label="Vehicle photos" aria-roledescription="carousel" className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-neutral-100">
        <div
          ref={strip}
          tabIndex={count > 1 ? 0 : undefined}
          onKeyDown={(e) => {
            if (count < 2) return;
            if (e.key === "ArrowLeft") scrollTo(index - 1);
            if (e.key === "ArrowRight") scrollTo(index + 1);
          }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <div
              key={`${i}-${src}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Photo ${i + 1} of ${count}`}
              className="relative aspect-[16/10] w-full shrink-0 snap-center"
            >
              <VehicleImage
                src={src}
                alt={count > 1 ? `${alt}, photo ${i + 1} of ${count}` : alt}
                bodyType={bodyType}
                sizes="(min-width: 1024px) 60vw, 100vw"
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => scrollTo(index - 1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-neutral-950/70 text-white transition-colors hover:bg-neutral-950"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo(index + 1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-neutral-950/70 text-white transition-colors hover:bg-neutral-950"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <p
              aria-live="polite"
              className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-neutral-950/70 px-3 py-1 text-xs font-medium text-white"
            >
              {index + 1} / {count}
            </p>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((src, i) => (
            <li key={`${i}-${src}`}>
              <button
                type="button"
                onClick={() => scrollTo(i)}
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
