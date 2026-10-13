"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlState } from "@/components/admin/use-url-state";

const ALL = "__all__";

/** A select bound to one URL param. */
export function FilterSelect({
  param,
  label,
  allLabel,
  options,
  className = "w-44",
}: {
  param: string;
  label: string;
  allLabel: string;
  options: readonly string[] | { value: string; label: string }[];
  className?: string;
}) {
  const { get, setParams } = useUrlState();
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Select value={get(param) || ALL} onValueChange={(v) => setParams({ [param]: v === ALL ? null : v })}>
      <SelectTrigger aria-label={label} className={`h-9 ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
