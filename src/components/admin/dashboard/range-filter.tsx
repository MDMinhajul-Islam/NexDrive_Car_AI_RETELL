"use client";

import { Loader2 } from "lucide-react";
import { useUrlState } from "@/components/admin/use-url-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PRESETS = [7, 30, 90] as const;

/** Global date range. Changing it re-runs every widget's query on the server. */
export function RangeFilter({
  from,
  to,
  preset,
  today,
}: {
  from: string;
  to: string;
  preset: number | null;
  today: string;
}) {
  const { setParams, pending } = useUrlState();
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Date range for all widgets">
      {pending ? <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" aria-label="Updating" /> : null}
      <div className="inline-flex rounded-lg border bg-card p-0.5">
        {PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={preset === days}
            onClick={() => setParams({ range: days, from: null, to: null })}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-medium transition-colors",
              preset === days ? "bg-neutral-950 text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {days} days
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="dash-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="dash-from"
          type="date"
          value={from}
          max={to}
          onChange={(e) => e.target.value && setParams({ from: e.target.value, to, range: null })}
          className="h-9 w-40 bg-card"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dash-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="dash-to"
          type="date"
          value={to}
          min={from}
          max={today}
          onChange={(e) => e.target.value && setParams({ from, to: e.target.value, range: null })}
          className="h-9 w-40 bg-card"
        />
      </div>
    </div>
  );
}

/** Small segmented control bound to one URL param (used inside chart cards). */
export function ParamToggle({
  param,
  value,
  options,
  label,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const { setParams } = useUrlState();
  return (
    <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => setParams({ [param]: o.value }, { keepPage: true })}
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-neutral-950 text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
