import type { Metadata } from "next";
import { Clock, IdCard, MapPin, Phone } from "lucide-react";
import { BookingForm } from "@/components/site/booking-form";
import { PageHeader } from "@/components/site/section";
import { SITE } from "@/lib/constants";
import { getVehicle, isTestDriveEligible } from "@/lib/data/vehicles";
import { addDays, todayInDealershipTz, vehicleName } from "@/lib/format";
import { isTurnstileEnabled } from "@/lib/security/turnstile";

export const metadata: Metadata = {
  title: "Book a test drive",
  description:
    "Reserve a 30-minute test drive at NexDrive in Plano, Texas. Choose your vehicle, pick an open time and we will have the car ready when you arrive.",
  alternates: { canonical: "/book" },
  openGraph: { title: "Book a test drive at NexDrive", url: "/book" },
};

type Props = { searchParams: Promise<{ vehicle?: string | string[] }> };

const STEPS = [
  { icon: Clock, title: "30 minutes", body: "Enough time for city streets and a stretch of highway." },
  { icon: IdCard, title: "Bring your license", body: "A valid driver license is all you need. Insurance is on us." },
  { icon: MapPin, title: "Ready when you arrive", body: "Your car is pulled up front, cleaned and fuelled or charged." },
];

export default async function BookPage({ searchParams }: Props) {
  const { vehicle: param } = await searchParams;
  const requestedId = Array.isArray(param) ? param[0] : param;
  const vehicle = requestedId ? await getVehicle(requestedId).catch(() => null) : null;
  const preselected = vehicle && isTestDriveEligible(vehicle) ? vehicle : null;
  const today = todayInDealershipTz();

  return (
    <>
      <PageHeader
        eyebrow="Test drive"
        title="Book a test drive"
        description="Pick a vehicle and a time that suits you. A NexDrive specialist will confirm your appointment and have the car waiting."
      />
      <div className="container-page grid grid-cols-1 gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-16">
        <div className="min-w-0 rounded-2xl border bg-card p-4 sm:p-8">
          {vehicle && !preselected ? (
            <p role="status" className="mb-6 rounded-xl bg-muted p-4 text-sm leading-6">
              The {vehicleName(vehicle)} is not available for test drives right now. Choose another vehicle below,
              or call {SITE.phoneDisplay} and we will help.
            </p>
          ) : null}
          <BookingForm
            turnstileEnabled={isTurnstileEnabled()}
            minDate={today}
            maxDate={addDays(today, 60)}
            initialVehicle={
              preselected
                ? {
                    id: preselected.vehicle_id,
                    name: vehicleName(preselected),
                    price: preselected.sale_price,
                    location: preselected.dealership_location,
                  }
                : null
            }
          />
        </div>

        <aside aria-label="What to expect" className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">What to expect</h2>
            <ul className="mt-6 space-y-6">
              {STEPS.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-950 text-brand">
                    <s.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-muted p-6">
            <h2 className="text-sm font-semibold">Prefer to book by phone?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Our team answers every day. All times are US Central.
            </p>
            <a href={`tel:${SITE.phone}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-base font-semibold">
              <Phone className="size-4" aria-hidden="true" />
              {SITE.phoneDisplay}
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}
