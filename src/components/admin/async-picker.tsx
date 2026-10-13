"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PickerOption } from "@/app/actions/admin/bookings";

/** Typeahead backed by a Server Action, so large tables are searched in Postgres. */
export function AsyncPicker({
  id,
  value,
  onChange,
  search,
  placeholder,
  emptyText,
  invalid,
}: {
  id: string;
  value: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
  search: (term: string) => Promise<PickerOption[]>;
  placeholder: string;
  emptyText: string;
  invalid?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PickerOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const found = await search(term);
          if (!cancelled) setResults(found);
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      term ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, value, search]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.label}</p>
          <p className="truncate text-xs text-muted-foreground">{value.detail}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X aria-hidden="true" /> Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-controls={`${id}-results`}
          maxLength={60}
          className="h-9 pl-9"
        />
        {loading ? (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div id={`${id}-results`} aria-live="polite" className="max-h-44 overflow-y-auto rounded-lg border">
        {results && results.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {(results ?? []).map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => onChange(option)}
                  className="block w-full px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted"
                >
                  <span className="block truncate text-sm font-medium">{option.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{option.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
