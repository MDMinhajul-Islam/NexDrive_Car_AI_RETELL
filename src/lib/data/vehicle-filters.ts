import {
  BODY_TYPES,
  FUEL_TYPES,
  TRANSMISSIONS,
  VEHICLE_CONDITIONS,
  VEHICLE_YEAR_MAX,
  VEHICLE_YEAR_MIN,
} from "@/lib/constants";

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest listings" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "year-desc", label: "Year: newest first" },
  { value: "mileage-asc", label: "Mileage: lowest first" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export type VehicleFilters = {
  q: string;
  make: string;
  body: string;
  fuel: string;
  transmission: string;
  condition: string;
  minPrice: number | null;
  maxPrice: number | null;
  minYear: number | null;
  maxYear: number | null;
  sort: SortValue;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function oneOf<T extends readonly string[]>(value: string, allowed: T): string {
  return (allowed as readonly string[]).includes(value) ? value : "";
}

function int(value: string, min: number, max: number): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

/** Validates URL search params. Unknown or malformed values are dropped, never trusted. */
export function parseVehicleFilters(sp: RawSearchParams): VehicleFilters {
  const sort = first(sp.sort);
  return {
    q: first(sp.q).trim().slice(0, 60),
    make: first(sp.make).trim().slice(0, 40),
    body: oneOf(first(sp.body), BODY_TYPES),
    fuel: oneOf(first(sp.fuel), FUEL_TYPES),
    transmission: oneOf(first(sp.transmission), TRANSMISSIONS),
    condition: oneOf(first(sp.condition), VEHICLE_CONDITIONS),
    minPrice: int(first(sp.minPrice), 0, 10_000_000),
    maxPrice: int(first(sp.maxPrice), 0, 10_000_000),
    minYear: int(first(sp.minYear), VEHICLE_YEAR_MIN, VEHICLE_YEAR_MAX),
    maxYear: int(first(sp.maxYear), VEHICLE_YEAR_MIN, VEHICLE_YEAR_MAX),
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as SortValue) : "newest",
    page: int(first(sp.page), 1, 100_000) ?? 1,
  };
}

/** Serializes filters back to a query string, omitting defaults. */
export function filtersToQuery(filters: Partial<VehicleFilters>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === "") continue;
    if (key === "sort" && value === "newest") continue;
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function countActiveFilters(f: VehicleFilters) {
  return [f.q, f.make, f.body, f.fuel, f.transmission, f.condition, f.minPrice, f.maxPrice, f.minYear, f.maxYear].filter(
    (v) => v !== "" && v != null,
  ).length;
}
