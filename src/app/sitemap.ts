import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { createPublicClient } from "@/lib/supabase/server";

// Regenerate at most once an hour.
export const revalidate = 3600;

/** PostgREST caps a response at 1,000 rows, so vehicles are read in pages. */
const PAGE = 1000;
const MAX_VEHICLES = 20000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/cars`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE.url}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const vehicles: MetadataRoute.Sitemap = [];
  try {
    const supabase = createPublicClient();
    for (let from = 0; from < MAX_VEHICLES; from += PAGE) {
      const { data, error } = await supabase
        .from("vehicles")
        .select("vehicle_id, updated_at")
        .neq("vehicle_status", "Sold")
        .order("vehicle_id")
        .range(from, from + PAGE - 1);
      if (error || !data?.length) break;
      for (const v of data) {
        vehicles.push({
          url: `${SITE.url}/cars/${v.vehicle_id}`,
          lastModified: new Date(v.updated_at),
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
      if (data.length < PAGE) break;
    }
  } catch (err) {
    console.error("[sitemap] vehicle lookup failed:", err);
  }
  return [...staticRoutes, ...vehicles];
}
