import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="NexDrive home"
      className={cn("inline-flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight", className)}
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-ink"
      >
        N
      </span>
      <span>
        Nex<span className="text-brand">Drive</span>
      </span>
    </Link>
  );
}
