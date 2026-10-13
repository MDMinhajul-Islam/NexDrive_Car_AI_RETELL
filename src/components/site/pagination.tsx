import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pageWindow(current: number, total: number): (number | "gap")[] {
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const base =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg border px-3 text-sm font-medium transition-colors";

export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(base, "hover:bg-muted")}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span>Previous</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-muted-foreground opacity-60")}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span>Previous</span>
        </span>
      )}

      <ul className="hidden items-center gap-2 sm:flex">
        {pageWindow(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              &hellip;
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  base,
                  p === page ? "border-neutral-950 bg-neutral-950 text-white" : "hover:bg-muted",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      <p className="px-2 text-sm text-muted-foreground sm:hidden">
        Page {page} of {pageCount}
      </p>

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(base, "hover:bg-muted")}>
          <span>Next</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-muted-foreground opacity-60")}>
          <span>Next</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
