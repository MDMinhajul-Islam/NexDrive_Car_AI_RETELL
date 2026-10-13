import { cn } from "@/lib/utils";

const APPOINTMENT_STYLES: Record<string, string> = {
  Requested: "bg-amber-50 text-amber-900 ring-amber-600/30",
  Confirmed: "bg-sky-50 text-sky-800 ring-sky-600/20",
  Completed: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  Cancelled: "bg-neutral-100 text-neutral-700 ring-neutral-500/20",
  "No Show": "bg-rose-50 text-rose-800 ring-rose-600/20",
  Rescheduled: "bg-violet-50 text-violet-800 ring-violet-600/20",
};

export function AppointmentStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        APPOINTMENT_STYLES[status] ?? APPOINTMENT_STYLES.Cancelled,
        className,
      )}
    >
      {status}
    </span>
  );
}
