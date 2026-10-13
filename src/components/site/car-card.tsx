import Link from "next/link";
import { ArrowUpRight, Fuel, Gauge, Settings2 } from "lucide-react";
import { VehicleImage } from "@/components/site/vehicle-image";
import { VehicleStatusBadge } from "@/components/site/status-badge";
import { formatCurrency, formatMileage } from "@/lib/format";
import type { VehicleWithImages } from "@/lib/data/vehicles";

export function CarCard({ vehicle, priority = false }: { vehicle: VehicleWithImages; priority?: boolean }) {
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const hasDiscount = vehicle.msrp > vehicle.sale_price;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow duration-300 focus-within:ring-2 focus-within:ring-ring hover:shadow-xl hover:shadow-black/5">
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
        <VehicleImage
          src={vehicle.images[0]}
          alt={`${title} ${vehicle.trim} in ${vehicle.exterior_color}`}
          bodyType={vehicle.body_type}
          sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          className="transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-neutral-950/85 px-2.5 py-1 text-xs font-medium text-white">
            {vehicle.condition}
          </span>
          {vehicle.vehicle_status !== "Available" ? <VehicleStatusBadge status={vehicle.vehicle_status} /> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight">
              <Link href={`/cars/${vehicle.vehicle_id}`} className="outline-none after:absolute after:inset-0">
                {title}
              </Link>
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {vehicle.trim} &middot; {vehicle.body_type} &middot; {vehicle.exterior_color}
            </p>
          </div>
          <ArrowUpRight
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </div>

        <ul className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Gauge className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{formatMileage(vehicle.mileage)}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Fuel className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{vehicle.fuel_type}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Settings2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{vehicle.drivetrain}</span>
          </li>
        </ul>

        <div className="mt-auto flex items-end justify-between border-t pt-4">
          <div>
            <p className="text-xl font-semibold tracking-tight">{formatCurrency(vehicle.sale_price)}</p>
            {hasDiscount ? (
              <p className="text-xs text-muted-foreground">
                <span className="sr-only">Original price </span>
                <s>{formatCurrency(vehicle.msrp)}</s> MSRP
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">Stock {vehicle.stock_number}</p>
        </div>
      </div>
    </article>
  );
}

export function CarCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-4 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
