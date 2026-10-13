import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  invert = false,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  invert?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
      )}
    >
      <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
        {eyebrow ? (
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.2em]",
              invert ? "text-brand" : "text-brand-ink",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2 className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", invert && "text-white")}>
          {title}
        </h2>
        {description ? (
          <p className={cn("text-base leading-7", invert ? "text-neutral-300" : "text-muted-foreground")}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="bg-neutral-950 text-white">
      <div className="container-page py-12 sm:py-16">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {description ? <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-300">{description}</p> : null}
      </div>
    </div>
  );
}
