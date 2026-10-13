import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BUYER_PROFILES } from "@/lib/constants";
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

export const CUSTOMER_SORTS = ["updated_at", "created_at", "last_name", "customer_id", "budget_max"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];
export type CustomerFilters = TableParams<CustomerSort> & { profile: string };
export type CustomerRow = Tables<"customers">;

export function parseCustomerFilters(sp: RawParams): CustomerFilters {
  return {
    ...parseTableParams(sp, CUSTOMER_SORTS, { sort: "updated_at", dir: "desc" }),
    profile: oneOf(first(sp.profile), BUYER_PROFILES),
  };
}

/** One page of customers. Search, filter, sort and paging run in Postgres. */
export async function listCustomers(filters: CustomerFilters): Promise<Paged<CustomerRow>> {
  const supabase = await createClient();
  let query = supabase.from("customers").select("*", { count: "exact" });

  const term = sanitizeTerm(filters.q);
  if (/^CUST-?\d{1,6}$/i.test(term)) {
    query = query.ilike("customer_id", `%${term.replace(/\D/g, "")}`);
  } else {
    for (const word of term.split(" ").filter(Boolean).slice(0, 4)) {
      query = query.or(
        `first_name.ilike.%${word}%,last_name.ilike.%${word}%,synthetic_phone.ilike.%${word}%,synthetic_email.ilike.%${word}%,city.ilike.%${word}%`,
      );
    }
  }
  if (filters.profile) query = query.eq("buyer_profile", filters.profile);

  query = query
    .order(filters.sort, { ascending: filters.dir === "asc", nullsFirst: false })
    .order("customer_id", { ascending: true });

  const from = (filters.page - 1) * filters.pageSize;
  const { data, count, error } = await query.range(from, from + filters.pageSize - 1);
  if (error) {
    if (error.code === "PGRST103") return { rows: [], total: count ?? 0, error: null };
    console.error("[admin] customers list failed:", error.message);
    return { rows: [], total: 0, error: "Customers could not be loaded." };
  }
  return { rows: data ?? [], total: count ?? 0, error: null };
}
