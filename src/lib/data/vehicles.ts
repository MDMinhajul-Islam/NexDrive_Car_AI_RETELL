import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import {
  BODY_TYPES,
  FUEL_TYPES,
  INVENTORY_PAGE_SIZE,
  TRANSMISSIONS,
  VEHICLE_YEAR_MAX,
} from "@/lib/constants";
import { bodyTypeFallbackImage, modelImageKey, storageImageUrl } from "@/lib/images";
import type { VehicleFilters } from "@/lib/data/vehicle-filters";
import type { Tables } from "@/types/database";

export type Vehicle = Tables<"vehicles">;
export type VehicleWithImages = Vehicle & { images: string[] };

export type Facets = {
  makes: string[];
  bodyTypes: string[];
  fuelTypes: string[];
  transmissions: string[];
  yearMin: number;
  yearMax: number;
  priceMin: number;
  priceMax: number;
};

type ImageSource = Pick<Vehicle, "vehicle_id" | "make" | "model" | "body_type">;

/**
 * Gallery order for each vehicle:
 *   1. its own uploads in vehicle_images (primary first, then sort_order)
 *   2. the stock photo for its make and model in vehicle_model_images (image_url only)
 *   3. a body-type fallback image
 * Two small queries per page of vehicles, never one per vehicle.
 */
export async function resolveVehicleImages<T extends ImageSource>(
  vehicles: T[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (vehicles.length === 0) return result;

  const supabase = createPublicClient();
  const ids = vehicles.map((v) => v.vehicle_id);
  const keys = [...new Set(vehicles.map((v) => modelImageKey(v.make, v.model)))];

  const [own, model] = await Promise.all([
    supabase
      .from("vehicle_images")
      .select("vehicle_id, storage_path, is_primary, sort_order")
      .in("vehicle_id", ids)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase.from("vehicle_model_images").select("image_key, image_url").in("image_key", keys),
  ]);

  const ownByVehicle = new Map<string, string[]>();
  for (const row of own.data ?? []) {
    const list = ownByVehicle.get(row.vehicle_id) ?? [];
    list.push(storageImageUrl(row.storage_path));
    ownByVehicle.set(row.vehicle_id, list);
  }
  const modelByKey = new Map<string, string>();
  for (const row of model.data ?? []) {
    if (row.image_url.startsWith("https://")) modelByKey.set(row.image_key, row.image_url);
  }

  for (const v of vehicles) {
    const images = [...(ownByVehicle.get(v.vehicle_id) ?? [])];
    const stock = modelByKey.get(modelImageKey(v.make, v.model));
    if (stock) images.push(stock);
    if (images.length === 0) images.push(bodyTypeFallbackImage(v.body_type));
    result.set(v.vehicle_id, images);
  }
  return result;
}

async function withImages(vehicles: Vehicle[]): Promise<VehicleWithImages[]> {
  const images = await resolveVehicleImages(vehicles);
  return vehicles.map((v) => ({ ...v, images: images.get(v.vehicle_id) ?? [bodyTypeFallbackImage(v.body_type)] }));
}

/** Strips characters that have meaning inside a PostgREST `or=()` filter. */
function sanitizeSearchTerm(term: string) {
  return term.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

export type VehicleListResult = {
  vehicles: VehicleWithImages[];
  total: number;
  page: number;
  pageCount: number;
  error: boolean;
};

/**
 * Inventory query. Filtering, sorting and pagination all happen in Postgres,
 * and only one page of rows is ever fetched (the table holds 10,000 vehicles).
 */
export async function listVehicles(filters: VehicleFilters): Promise<VehicleListResult> {
  const supabase = createPublicClient();
  let query = supabase
    .from("vehicles")
    .select("*", { count: "exact" })
    .neq("vehicle_status", "Sold");

  const term = sanitizeSearchTerm(filters.q);
  if (term) {
    // Every word must match make, model, trim or stock number.
    for (const word of term.split(" ").slice(0, 5)) {
      const numeric = /^\d{4}$/.test(word) ? `,year.eq.${word}` : "";
      query = query.or(
        `make.ilike.%${word}%,model.ilike.%${word}%,trim.ilike.%${word}%,stock_number.ilike.%${word}%${numeric}`,
      );
    }
  }
  if (filters.make) query = query.eq("make", filters.make);
  if (filters.body) query = query.eq("body_type", filters.body);
  if (filters.fuel) query = query.eq("fuel_type", filters.fuel);
  if (filters.transmission) query = query.eq("transmission", filters.transmission);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.minPrice != null) query = query.gte("sale_price", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("sale_price", filters.maxPrice);
  if (filters.minYear != null) query = query.gte("year", filters.minYear);
  if (filters.maxYear != null) query = query.lte("year", filters.maxYear);

  switch (filters.sort) {
    case "price-asc":
      query = query.order("sale_price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("sale_price", { ascending: false });
      break;
    case "year-desc":
      query = query.order("year", { ascending: false });
      break;
    case "mileage-asc":
      query = query.order("mileage", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }
  // Stable tiebreaker so pages never overlap.
  query = query.order("vehicle_id", { ascending: true });

  const from = (filters.page - 1) * INVENTORY_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + INVENTORY_PAGE_SIZE - 1);

  if (error) {
    // PGRST103 = requested page is past the end of the result set.
    if (error.code !== "PGRST103") console.error("[vehicles] list failed:", error.message);
    return { vehicles: [], total: 0, page: filters.page, pageCount: 0, error: error.code !== "PGRST103" };
  }
  const total = count ?? 0;
  return {
    vehicles: await withImages(data ?? []),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)),
    error: false,
  };
}

export type VehicleDetail = VehicleWithImages & {
  features: { name: string; category: string }[];
};

export async function getVehicle(vehicleId: string): Promise<VehicleDetail | null> {
  if (!/^VEH-[0-9]{6}$/.test(vehicleId)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_features(features(name, category))")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (error) {
    console.error("[vehicles] get failed:", error.message);
    throw new Error("We could not load this vehicle.");
  }
  if (!data) return null;

  const { vehicle_features, ...vehicle } = data;
  const features = (vehicle_features ?? [])
    .map((vf) => vf.features)
    .filter((f): f is { name: string; category: string } => Boolean(f))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const [withImg] = await withImages([vehicle]);
  return { ...withImg, features };
}

/** Featured vehicles for the home page; falls back to the newest available stock. */
export async function getFeaturedVehicles(limit = 6): Promise<VehicleWithImages[]> {
  const supabase = createPublicClient();
  const featured = await supabase
    .from("vehicles")
    .select("*")
    .eq("is_featured", true)
    .in("vehicle_status", ["Available", "Demo Vehicle"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  let rows = featured.data ?? [];
  if (rows.length < limit) {
    const exclude = rows.map((r) => r.vehicle_id);
    let fill = supabase
      .from("vehicles")
      .select("*")
      .eq("vehicle_status", "Available")
      .order("year", { ascending: false })
      .order("sale_price", { ascending: false })
      .limit(limit - rows.length);
    if (exclude.length) fill = fill.not("vehicle_id", "in", `(${exclude.join(",")})`);
    const { data, error } = await fill;
    if (error) console.error("[vehicles] featured failed:", error.message);
    rows = [...rows, ...(data ?? [])];
  }
  return withImages(rows);
}

export async function getSimilarVehicles(vehicle: Vehicle, limit = 3): Promise<VehicleWithImages[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("body_type", vehicle.body_type)
    .eq("vehicle_status", "Available")
    .neq("vehicle_id", vehicle.vehicle_id)
    .gte("sale_price", Math.floor(vehicle.sale_price * 0.75))
    .lte("sale_price", Math.ceil(vehicle.sale_price * 1.25))
    .order("year", { ascending: false })
    .limit(limit);
  return withImages(data ?? []);
}

const STATIC_FACETS: Facets = {
  makes: [],
  bodyTypes: [...BODY_TYPES],
  fuelTypes: [...FUEL_TYPES],
  transmissions: [...TRANSMISSIONS],
  yearMin: 2000,
  yearMax: Math.min(VEHICLE_YEAR_MAX, new Date().getFullYear() + 1),
  priceMin: 0,
  priceMax: 100000,
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);

/** Distinct filter values, aggregated in Postgres by the inventory_facets() function. */
export async function getFacets(): Promise<Facets> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("inventory_facets");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    if (error) console.error("[vehicles] facets failed:", error.message);
    return STATIC_FACETS;
  }
  const d = data as Record<string, unknown>;
  const pick = (list: string[], fallback: string[]) => (list.length ? list : fallback);
  return {
    makes: strings(d.makes),
    bodyTypes: pick(strings(d.body_types), STATIC_FACETS.bodyTypes),
    fuelTypes: pick(strings(d.fuel_types), STATIC_FACETS.fuelTypes),
    transmissions: pick(strings(d.transmissions), STATIC_FACETS.transmissions),
    yearMin: num(d.year_min, STATIC_FACETS.yearMin),
    yearMax: num(d.year_max, STATIC_FACETS.yearMax),
    priceMin: num(d.price_min, STATIC_FACETS.priceMin),
    priceMax: num(d.price_max, STATIC_FACETS.priceMax),
  };
}

/**
 * Whether the website offers a test-drive booking for this vehicle.
 * Stricter than the table constraint on purpose: get_test_drive_slots only returns
 * times when the status is exactly 'Available' (Demo Vehicles get no slots).
 */
export function isTestDriveEligible(v: Pick<Vehicle, "vehicle_status" | "test_drive_available">) {
  return v.test_drive_available && v.vehicle_status === "Available";
}
