import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BODY_TYPES, VEHICLE_CONDITIONS, VEHICLE_STATUSES } from "@/lib/constants";
import {
  first,
  oneOf,
  parseTableParams,
  sanitizeTerm,
  type Paged,
  type RawParams,
  type TableParams,
} from "@/lib/admin/table-params";
import type { Tables } from "@/types/database";

export const CAR_SORTS = [
  "updated_at",
  "vehicle_id",
  "year",
  "make",
  "sale_price",
  "mileage",
  "vehicle_status",
] as const;
export type CarSort = (typeof CAR_SORTS)[number];

export type CarFilters = TableParams<CarSort> & {
  status: string;
  condition: string;
  body: string;
  featured: string;
};

export type CarRow = Tables<"vehicles">;
export type FeatureOption = { id: string; name: string; category: string };

export function parseCarFilters(sp: RawParams): CarFilters {
  return {
    ...parseTableParams(sp, CAR_SORTS, { sort: "updated_at", dir: "desc" }),
    status: oneOf(first(sp.status), VEHICLE_STATUSES),
    condition: oneOf(first(sp.condition), VEHICLE_CONDITIONS),
    body: oneOf(first(sp.body), BODY_TYPES),
    featured: first(sp.featured) === "yes" ? "yes" : "",
  };
}

/** One page of the 10,000-row inventory. Search, filters, sort and paging run in Postgres. */
export async function listCars(filters: CarFilters): Promise<Paged<CarRow>> {
  const supabase = await createClient();
  let query = supabase.from("vehicles").select("*", { count: "exact" });

  const term = sanitizeTerm(filters.q);
  if (/^(VEH|NX)-?\d{1,6}$/i.test(term)) {
    query = query.ilike("vehicle_id", `%${term.replace(/\D/g, "")}`);
  } else if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(term)) {
    query = query.eq("vin", term.toUpperCase());
  } else {
    for (const word of term.split(" ").filter(Boolean).slice(0, 5)) {
      const numeric = /^\d{4}$/.test(word) ? `,year.eq.${word}` : "";
      query = query.or(
        `make.ilike.%${word}%,model.ilike.%${word}%,trim.ilike.%${word}%,stock_number.ilike.%${word}%,vin.ilike.%${word}%${numeric}`,
      );
    }
  }
  if (filters.status) query = query.eq("vehicle_status", filters.status);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.body) query = query.eq("body_type", filters.body);
  if (filters.featured) query = query.eq("is_featured", true);

  query = query.order(filters.sort, { ascending: filters.dir === "asc" }).order("vehicle_id", { ascending: true });

  const from = (filters.page - 1) * filters.pageSize;
  const { data, count, error } = await query.range(from, from + filters.pageSize - 1);
  if (error) {
    if (error.code === "PGRST103") return { rows: [], total: count ?? 0, error: null };
    console.error("[admin] cars list failed:", error.message);
    return { rows: [], total: 0, error: "Inventory could not be loaded." };
  }
  return { rows: data ?? [], total: count ?? 0, error: null };
}

export async function listFeatures(): Promise<FeatureOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("features").select("feature_id, name, category").order("category").order("name");
  if (error) console.error("[admin] features list failed:", error.message);
  return (data ?? []).map((f) => ({ id: f.feature_id, name: f.name, category: f.category }));
}
