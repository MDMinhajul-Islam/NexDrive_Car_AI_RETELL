import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Award, CalendarX, Check, ChevronRight, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingForm } from "@/components/site/booking-form";
import { CarCard } from "@/components/site/car-card";
import { Gallery } from "@/components/site/gallery";
import { VehicleStatusBadge } from "@/components/site/status-badge";
import { SITE } from "@/lib/constants";
import { getSimilarVehicles, getVehicle, isTestDriveEligible } from "@/lib/data/vehicles";
import { addDays, formatCurrency, formatMileage, todayInDealershipTz, vehicleName } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

// One query shared by generateMetadata and the page.
const loadVehicle = cache(getVehicle);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vehicle = await loadVehicle(id).catch(() => null);
  if (!vehicle) return { title: "Vehicle not found", robots: { index: false } };
  const name = vehicleName(vehicle);
  const description = `${vehicle.condition} ${name} in ${vehicle.exterior_color} with ${formatMileage(vehicle.mileage)}, ${vehicle.drivetrain}, ${vehicle.fuel_type}. ${formatCurrency(vehicle.sale_price)} at NexDrive ${vehicle.dealership_location}.`;
  return {
    title: `${name} for sale`,
    description,
    alternates: { canonical: `/cars/${vehicle.vehicle_id}` },
    openGraph: {
      title: `${name} | ${formatCurrency(vehicle.sale_price)}`,
      description,
      url: `/cars/${vehicle.vehicle_id}`,
      images: [{ url: vehicle.images[0], alt: name }],
    },
  };
}

export default async function VehiclePage({ params }: Props) {
  const { id } = await params;
  const vehicle = await loadVehicle(id);
  if (!vehicle) notFound();

  const name = vehicleName(vehicle);
  const similar = await getSimilarVehicles(vehicle);
  const bookable = isTestDriveEligible(vehicle);
  const today = todayInDealershipTz();
  const savings = vehicle.msrp - vehicle.sale_price;

  const specs: [string, string][] = [
    ["Condition", vehicle.condition],
    ["Year", String(vehicle.year)],
    ["Make", vehicle.make],
    ["Model", vehicle.model],
    ["Trim", vehicle.trim],
    ["Body type", vehicle.body_type],
    ["Mileage", formatMileage(vehicle.mileage)],
    ["Fuel type", vehicle.fuel_type],
    ["Transmission", vehicle.transmission],
    ["Drivetrain", vehicle.drivetrain],
    ["Seating", `${vehicle.seating_capacity} passengers`],
    ["Exterior color", vehicle.exterior_color],
    ["Interior color", vehicle.interior_color],
    ["Warranty", vehicle.warranty],
    ["Certification", vehicle.certification],
    ["Location", vehicle.dealership_location],
    ["Stock number", vehicle.stock_number],
    ["VIN", vehicle.vin],
  ];

  const featureGroups = new Map<string, string[]>();
  for (const f of vehicle.features) {
    featureGroups.set(f.category, [...(featureGroups.get(f.category) ?? []), f.name]);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name,
    brand: { "@type": "Brand", name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    vehicleIdentificationNumber: vehicle.vin,
    bodyType: vehicle.body_type,
    color: vehicle.exterior_color,
    fuelType: vehicle.fuel_type,
    vehicleTransmission: vehicle.transmission,
    driveWheelConfiguration: vehicle.drivetrain,
    mileageFromOdometer: { "@type": "QuantitativeValue", value: vehicle.mileage, unitCode: "SMI" },
    itemCondition: vehicle.condition === "New" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    image: vehicle.images,
    offers: {
      "@type": "Offer",
      price: vehicle.sale_price,
      priceCurrency: "USD",
      availability:
        vehicle.vehicle_status === "Sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      url: `${SITE.url}/cars/${vehicle.vehicle_id}`,
    },
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <script
        type="application/ld+json"
        // Escape "<" so vehicle data can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href="/cars" className="hover:text-foreground">
              Inventory
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href={`/cars?make=${encodeURIComponent(vehicle.make)}`} className="hover:text-foreground">
              {vehicle.make}
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li aria-current="page" className="font-medium text-foreground">
            {vehicle.year} {vehicle.model}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-12">
          <Gallery images={vehicle.images} alt={`${name} in ${vehicle.exterior_color}`} bodyType={vehicle.body_type} />

          {/* Title block (mobile shows it under the gallery, before the sidebar) */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-medium text-white">
                {vehicle.condition}
              </span>
              <VehicleStatusBadge status={vehicle.vehicle_status} />
              {vehicle.certification !== "None" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  <Award className="size-3.5" aria-hidden="true" />
                  {vehicle.certification}
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden="true" />
              {vehicle.dealership_location} &middot; Stock {vehicle.stock_number}
            </p>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-4xl font-semibold tracking-tight">{formatCurrency(vehicle.sale_price)}</p>
              {savings > 0 ? (
                <p className="pb-1 text-sm text-muted-foreground">
                  <s>{formatCurrency(vehicle.msrp)}</s> MSRP &middot;{" "}
                  <span className="font-medium text-emerald-700">Save {formatCurrency(savings)}</span>
                </p>
              ) : null}
            </div>
          </header>

          {/* Key facts */}
          <section aria-labelledby="highlights-heading">
            <h2 id="highlights-heading" className="sr-only">
              Highlights
            </h2>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
              {[
                ["Mileage", formatMileage(vehicle.mileage)],
                ["Fuel", vehicle.fuel_type],
                ["Drivetrain", vehicle.drivetrain],
                ["Seats", String(vehicle.seating_capacity)],
              ].map(([label, value]) => (
                <div key={label} className="bg-card p-5">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold tracking-tight">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Key features */}
          <section aria-labelledby="features-heading" className="space-y-6">
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
              Key features
            </h2>
            {featureGroups.size > 0 ? (
              <div className="grid gap-8 sm:grid-cols-2">
                {[...featureGroups.entries()].map(([category, names]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold">{category}</h3>
                    <ul className="mt-3 space-y-2">
                      {names.map((n) => (
                        <li key={n} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The full equipment list for this vehicle is available on request. Call {SITE.phoneDisplay} and we
                will send it over.
              </p>
            )}
          </section>

          {/* Specs */}
          <section aria-labelledby="specs-heading" className="space-y-6">
            <h2 id="specs-heading" className="text-2xl font-semibold tracking-tight">
              Specifications
            </h2>
            <div className="overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <caption className="sr-only">Specifications for the {name}</caption>
                <tbody className="divide-y">
                  {specs.map(([label, value]) => (
                    <tr key={label} className="even:bg-muted/40">
                      <th scope="row" className="w-2/5 px-5 py-3 text-left font-normal text-muted-foreground">
                        {label}
                      </th>
                      <td className={label === "VIN" || label === "Stock number" ? "px-5 py-3 font-mono" : "px-5 py-3 font-medium"}>
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Booking */}
        <aside aria-labelledby="book-heading" className="lg:sticky lg:top-24 lg:self-start">
          <div id="book" className="scroll-mt-24 rounded-2xl border bg-card p-6">
            <h2 id="book-heading" className="text-xl font-semibold tracking-tight">
              Book a test drive
            </h2>
            {bookable ? (
              <>
                <p className="mt-1 mb-6 text-sm text-muted-foreground">
                  30 minutes, no obligation. We will have this car ready for you.
                </p>
                <BookingForm
                  compact
                  minDate={today}
                  maxDate={addDays(today, 60)}
                  initialVehicle={{
                    id: vehicle.vehicle_id,
                    name,
                    price: vehicle.sale_price,
                    location: vehicle.dealership_location,
                  }}
                />
              </>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm leading-6">
                  <CalendarX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  This vehicle is not available for test drives right now
                  {vehicle.vehicle_status !== "Available" ? ` (${vehicle.vehicle_status.toLowerCase()})` : ""}. Our
                  team can suggest similar cars or let you know when it is ready.
                </p>
                <Button asChild className="h-11 w-full text-base">
                  <a href={`tel:${SITE.phone}`}>
                    <Phone aria-hidden="true" /> Call {SITE.phoneDisplay}
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-11 w-full text-base">
                  <Link href="/contact">Send us a message</Link>
                </Button>
              </div>
            )}
          </div>
          <p className="mt-4 flex items-start gap-2 px-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {vehicle.warranty}. Price excludes tax, title, license and dealer fees.
          </p>
        </aside>
      </div>

      {similar.length > 0 ? (
        <section aria-labelledby="similar-heading" className="mt-20 border-t pt-16">
          <h2 id="similar-heading" className="text-2xl font-semibold tracking-tight">
            Similar vehicles
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((v) => (
              <li key={v.vehicle_id}>
                <CarCard vehicle={v} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
