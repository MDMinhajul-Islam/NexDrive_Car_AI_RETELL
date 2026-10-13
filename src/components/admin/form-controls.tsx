"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const NONE = "__none__";

/** shadcn Select wired to React Hook Form. `nullable` adds a "Not set" option mapped to null. */
export function SelectField<T extends FieldValues>({
  control,
  name,
  id,
  options,
  placeholder = "Choose",
  nullable = false,
  invalid,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  placeholder?: string;
  nullable?: boolean;
  invalid?: boolean;
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={field.value == null || field.value === "" ? (nullable ? NONE : "") : String(field.value)}
          onValueChange={(v) => field.onChange(v === NONE ? null : v)}
        >
          <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} className="h-9 w-full" aria-invalid={invalid || undefined}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {nullable ? <SelectItem value={NONE}>Not set</SelectItem> : null}
            {items.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  id,
  label,
  description,
  error,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  label: string;
  description?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div>
          <Label htmlFor={id}>{label}</Label>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Switch
              id={id}
              ref={field.ref}
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              aria-invalid={Boolean(error) || undefined}
            />
          )}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
