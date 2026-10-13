import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
