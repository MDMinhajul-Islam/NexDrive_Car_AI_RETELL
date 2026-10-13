"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VEHICLE_CONDITIONS } from "@/lib/constants";
import {
  countActiveFilters,
  filtersToQuery,
  SORT_OPTIONS,
  type SortValue,
  type VehicleFilters,
} from "@/lib/data/vehicle-filters";
import type { Facets } from "@/lib/data/vehicles";
import { formatCurrency } from "@/lib/format";

const ANY = "__any__";
const PRICE_STEPS = [5000, 10000, 15000, 20000, 30000, 40000, 50000, 75000, 100000];

/** Pushes filter changes into the URL; the server re-queries on navigation. */
function useFilterNavigation(filters: VehicleFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<VehicleFilters>) => {
    const next = { ...filters, ...patch, page: 1 };
    startTransition(() => {
      router.push(`${pathname}${filtersToQuery(next)}`, { scroll: false });
    });
  };
  const reset = () => {
    startTransition(() => {
      router.push(pathname + (filters.sort !== "newest" ? `?sort=${filters.sort}` : ""), { scroll: false });
    });
  };
  return { update, reset, pending };
}

function FilterSelect({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? "" : v)}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterControls({
  idPrefix,
  facets,
  filters,
  update,
  reset,
}: {
  idPrefix: string;
  facets: Facets;
  filters: VehicleFilters;
  update: (patch: Partial<VehicleFilters>) => void;
  reset: () => void;
}) {
  const [term, setTerm] = useState(filters.q);
  const lastPushed = useRef(filters.q);

  // Keep the box in sync when the URL changes elsewhere (reset, back button).
  useEffect(() => {
    if (filters.q !== lastPushed.current) {
      lastPushed.current = filters.q;
      setTerm(filters.q);
    }
  }, [filters.q]);

  // Debounced search: one navigation after typing stops.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = trimmed;
      update({ q: trimmed });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const toOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
  const years = Array.from({ length: facets.yearMax - facets.yearMin + 1 }, (_, i) => String(facets.yearMax - i));
  const prices = PRICE_STEPS.map((p) => ({ value: String(p), label: formatCurrency(p) }));
  const numOrNull = (v: string) => (v ? Number(v) : null);
  const active = countActiveFilters(filters);

  return (
    <form role="search" aria-label="Filter inventory" className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-q`}>Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${idPrefix}-q`}
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Make, model or stock number"
            maxLength={60}
            className="h-10 pl-9"
          />
        </div>
      </div>

      {facets.makes.length > 0 ? (
        <FilterSelect
          id={`${idPrefix}-make`}
          label="Brand"
          value={filters.make}
          placeholder="All brands"
          options={toOptions(facets.makes)}
          onChange={(make) => update({ make })}
        />
      ) : null}
      <FilterSelect
        id={`${idPrefix}-body`}
        label="Body type"
        value={filters.body}
        placeholder="All body types"
        options={toOptions(facets.bodyTypes)}
        onChange={(body) => update({ body })}
      />
      <FilterSelect
        id={`${idPrefix}-condition`}
        label="Condition"
        value={filters.condition}
        placeholder="New and used"
        options={toOptions(VEHICLE_CONDITIONS)}
        onChange={(condition) => update({ condition })}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Price range</legend>
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            id={`${idPrefix}-min-price`}
            label="Minimum price"
            value={filters.minPrice != null ? String(filters.minPrice) : ""}
            placeholder="No min"
            options={prices}
            onChange={(v) => update({ minPrice: numOrNull(v) })}
          />
          <FilterSelect
            id={`${idPrefix}-max-price`}
            label="Maximum price"
            value={filters.maxPrice != null ? String(filters.maxPrice) : ""}
            placeholder="No max"
            options={prices}
            onChange={(v) => update({ maxPrice: numOrNull(v) })}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Model year</legend>
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            id={`${idPrefix}-min-year`}
            label="From year"
            value={filters.minYear != null ? String(filters.minYear) : ""}
            placeholder="Oldest"
            options={toOptions(years)}
            onChange={(v) => update({ minYear: numOrNull(v) })}
          />
          <FilterSelect
            id={`${idPrefix}-max-year`}
            label="To year"
            value={filters.maxYear != null ? String(filters.maxYear) : ""}
            placeholder="Newest"
            options={toOptions(years)}
            onChange={(v) => update({ maxYear: numOrNull(v) })}
          />
        </div>
      </fieldset>

      <FilterSelect
        id={`${idPrefix}-fuel`}
        label="Fuel type"
        value={filters.fuel}
        placeholder="All fuel types"
        options={toOptions(facets.fuelTypes)}
        onChange={(fuel) => update({ fuel })}
      />
      <FilterSelect
        id={`${idPrefix}-transmission`}
        label="Transmission"
        value={filters.transmission}
        placeholder="All transmissions"
        options={toOptions(facets.transmissions)}
        onChange={(transmission) => update({ transmission })}
      />

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full"
        disabled={active === 0}
        onClick={() => {
          lastPushed.current = "";
          setTerm("");
          reset();
        }}
      >
        <RotateCcw aria-hidden="true" />
        Reset filters
      </Button>
    </form>
  );
}

export function InventoryFilters({ facets, filters }: { facets: Facets; filters: VehicleFilters }) {
  const { update, reset, pending } = useFilterNavigation(filters);
  const active = countActiveFilters(filters);

  return (
    <>
      {/* Desktop sidebar */}
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-24 rounded-2xl border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-semibold">Filters</h2>
            {pending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating results" />
            ) : null}
          </div>
          <FilterControls idPrefix="desk" facets={facets} filters={filters} update={update} reset={reset} />
        </div>
      </aside>

      {/* Mobile sheet */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-10 px-4">
              <SlidersHorizontal aria-hidden="true" />
              Filters
              {active > 0 ? (
                <span className="ml-1 grid size-5 place-items-center rounded-full bg-brand text-xs font-semibold text-ink">
                  {active}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-8">
              <FilterControls idPrefix="mob" facets={facets} filters={filters} update={update} reset={reset} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export function InventorySort({ filters }: { filters: VehicleFilters }) {
  const { update, pending } = useFilterNavigation(filters);
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="inventory-sort" className="sr-only sm:not-sr-only sm:text-sm sm:text-muted-foreground">
        Sort by
      </Label>
      <Select value={filters.sort} onValueChange={(sort) => update({ sort: sort as SortValue })}>
        <SelectTrigger id="inventory-sort" className="h-10 w-52" aria-busy={pending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
