import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  "Demo Vehicle": "bg-sky-50 text-sky-800 ring-sky-600/20",
  "Arriving Soon": "bg-indigo-50 text-indigo-800 ring-indigo-600/20",
  Reserved: "bg-amber-50 text-amber-900 ring-amber-600/30",
  "Pending Sale": "bg-amber-50 text-amber-900 ring-amber-600/30",
  "In Service": "bg-neutral-100 text-neutral-800 ring-neutral-500/20",
  "No Test Drive": "bg-neutral-100 text-neutral-800 ring-neutral-500/20",
  Sold: "bg-rose-50 text-rose-800 ring-rose-600/20",
};

export function VehicleStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        STYLES[status] ?? STYLES["In Service"],
        className,
      )}
    >
      {status}
    </span>
  );
}
