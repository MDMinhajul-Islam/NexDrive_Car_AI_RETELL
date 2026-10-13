"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/components/admin/use-url-state";

/** Debounced search box bound to the `q` URL param; the server does the searching. */
export function SearchInput({ placeholder, label }: { placeholder: string; label: string }) {
  const { get, setParams } = useUrlState();
  const urlValue = get("q");
  const [value, setValue] = useState(urlValue);
  const lastPushed = useRef(urlValue);

  useEffect(() => {
    if (urlValue !== lastPushed.current) {
      lastPushed.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = trimmed;
      setParams({ q: trimmed });
    }, 350);
    return () => clearTimeout(timer);
  }, [value, setParams]);

  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={80}
        className="h-9 pl-9"
      />
    </div>
  );
}
