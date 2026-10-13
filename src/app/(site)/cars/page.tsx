import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarCard } from "@/components/site/car-card";
import { EmptyState } from "@/components/site/empty-state";
import { InventoryFilters, InventorySort } from "@/components/site/inventory-filters";
import { Pagination } from "@/components/site/pagination";
import { PageHeader } from "@/components/site/section";
import { INVENTORY_PAGE_SIZE } from "@/lib/constants";
import {
  filtersToQuery,
  parseVehicleFilters,
  type RawSearchParams,
  type VehicleFilters,
} from "@/lib/data/vehicle-filters";
import { getFacets, listVehicles } from "@/lib/data/vehicles";
import { formatCurrency, formatNumber } from "@/lib/format";

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseVehicleFilters(await searchParams);
  const subject = [f.condition, f.make, f.body ? `${f.body}s` : "vehicles"].filter(Boolean).join(" ");
  const filtered = Boolean(f.q || f.make || f.body || f.condition || f.fuel || f.transmission);
  const title = filtered ? `${subject} for sale` : "Inventory";
  const description = `Browse ${filtered ? subject : "new, certified pre-owned and used vehicles"} at NexDrive in Plano, Texas. Filter by brand, body type, price, year, fuel and transmission.`;
  return {
    title,
    description,
    alternates: { canonical: "/cars" },
    openGraph: { title, description, url: "/cars" },
    // Filtered and paginated views should not compete with the main listing.
    robots: filtered || f.page > 1 ? { index: false, follow: true } : undefined,
  };
}

function activeChips(f: VehicleFilters) {
  const chips: { label: string; without: Partial<VehicleFilters> }[] = [];
  if (f.q) chips.push({ label: `Search: ${f.q}`, without: { q: "" } });
  if (f.make) chips.push({ label: f.make, without: { make: "" } });
  if (f.body) chips.push({ label: f.body, without: { body: "" } });
  if (f.condition) chips.push({ label: f.condition, without: { condition: "" } });
  if (f.fuel) chips.push({ label: f.fuel, without: { fuel: "" } });
  if (f.transmission) chips.push({ label: f.transmission, without: { transmission: "" } });
  if (f.minPrice != null) chips.push({ label: `From ${formatCurrency(f.minPrice)}`, without: { minPrice: null } });
  if (f.maxPrice != null) chips.push({ label: `Up to ${formatCurrency(f.maxPrice)}`, without: { maxPrice: null } });
  if (f.minYear != null) chips.push({ label: `${f.minYear} or newer`, without: { minYear: null } });
  if (f.maxYear != null) chips.push({ label: `${f.maxYear} or older`, without: { maxYear: null } });
  return chips;
}

export default async function InventoryPage({ searchParams }: Props) {
  const filters = parseVehicleFilters(await searchParams);
  const [result, facets] = await Promise.all([listVehicles(filters), getFacets()]);
  const chips = activeChips(filters);
  const from = result.total === 0 ? 0 : (result.page - 1) * INVENTORY_PAGE_SIZE + 1;
  const to = Math.min(result.page * INVENTORY_PAGE_SIZE, result.total);

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Find your next vehicle"
        description="Every car on this page is on our Texas lots or on its way. Prices are current and updated as stock changes."
      />

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[18rem_1fr] lg:py-14">
        <InventoryFilters facets={facets} filters={filters} />

        <section aria-labelledby="results-heading" className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-heading" className="text-sm text-muted-foreground" aria-live="polite">
              {result.total > 0 ? (
                <>
                  Showing <span className="font-medium text-foreground">{formatNumber(from)}</span> to{" "}
                  <span className="font-medium text-foreground">{formatNumber(to)}</span> of{" "}
                  <span className="font-medium text-foreground">{formatNumber(result.total)}</span> vehicles
                </>
              ) : (
                "No vehicles to show"
              )}
            </h2>
            <InventorySort filters={filters} />
          </div>

          {chips.length > 0 ? (
            <ul aria-label="Active filters" className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <Link
                    href={`/cars${filtersToQuery({ ...filters, ...chip.without, page: 1 })}`}
                    scroll={false}
                    aria-label={`Remove filter ${chip.label}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-muted/60 pl-3 pr-2 text-sm transition-colors hover:bg-muted"
                  >
                    {chip.label}
                    <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {result.error ? (
            <EmptyState
              icon={TriangleAlert}
              title="We could not load the inventory"
              description="This is a problem on our side. Please refresh the page in a moment, or call us and we will check stock for you."
              action={
                <Button asChild variant="outline" className="h-10 px-5">
                  <Link href="/contact">Contact us</Link>
                </Button>
              }
            />
          ) : result.vehicles.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No vehicles match those filters"
              description="Try widening the price or year range, or clear the filters to see everything on the lot."
              action={
                <Button asChild className="h-10 px-5">
                  <Link href="/cars">Clear all filters</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {result.vehicles.map((vehicle, i) => (
                <li key={vehicle.vehicle_id}>
                  <CarCard vehicle={vehicle} priority={i < 3} />
                </li>
              ))}
            </ul>
          )}

          <div className="pt-4">
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={(page) => `/cars${filtersToQuery({ ...filters, page })}`}
            />
          </div>
        </section>
      </div>
    </>
  );
}
