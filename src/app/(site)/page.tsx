import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CarFront,
  HandCoins,
  Languages,
  Quote,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarCard } from "@/components/site/car-card";
import { EmptyState } from "@/components/site/empty-state";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section";
import { getFacets, getFeaturedVehicles } from "@/lib/data/vehicles";
import { SITE_IMAGES } from "@/lib/images";

// Featured stock changes slowly: rebuild the page at most every five minutes.
export const revalidate = 300;

const REASONS = [
  {
    icon: ShieldCheck,
    title: "Every vehicle inspected",
    body: "Each car is inspected before it reaches the lot, and certified pre-owned models carry manufacturer-backed coverage.",
  },
  {
    icon: HandCoins,
    title: "One clear price",
    body: "The price you see online is the price on the window. No hidden add-ons and no pressure to decide today.",
  },
  {
    icon: CalendarClock,
    title: "Test drives on your schedule",
    body: "Pick a 30-minute slot online and your car is pulled up, cleaned and waiting with a specialist when you arrive.",
  },
  {
    icon: Languages,
    title: "A team that speaks your language",
    body: "Our specialists work in English, Spanish, Hindi and Urdu, and financing terms run from 36 to 72 months.",
  },
];

const STATS = [
  { value: "30 min", label: "Reserved test-drive slots" },
  { value: "36 to 72", label: "Month financing terms" },
  { value: "4", label: "Languages spoken by our team" },
  { value: "7 days", label: "Open every day of the week" },
];

const TESTIMONIALS = [
  {
    quote:
      "I booked a test drive at lunch and was behind the wheel by five. The price matched the website exactly and the paperwork took under an hour.",
    name: "Priya Raman",
    detail: "Bought a certified pre-owned SUV",
  },
  {
    quote:
      "Third dealership I visited that week and the only one that did not try to upsell me. They walked me through the inspection report line by line.",
    name: "Marcus Delgado",
    detail: "Bought a used pickup",
  },
  {
    quote:
      "My parents are more comfortable in Spanish and the team made the whole visit easy for them. We left with the right car and a payment that fits.",
    name: "Elena Vasquez",
    detail: "Bought a new hybrid sedan",
  },
];

const FALLBACK_BRANDS = ["Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Volkswagen", "Hyundai", "Kia", "Tesla", "Subaru"];

const BODY_LINKS = [
  { label: "SUVs", body: "SUV" },
  { label: "Sedans", body: "Sedan" },
  { label: "Trucks", body: "Truck" },
  { label: "Hatchbacks", body: "Hatchback" },
];

export default async function HomePage() {
  const [featured, facets] = await Promise.all([getFeaturedVehicles(6), getFacets()]);
  const brands = [...new Set(facets.makes.length ? facets.makes : FALLBACK_BRANDS)].slice(0, 12);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <Image
          src={SITE_IMAGES.hero}
          alt="A dark sports sedan driving on an open road at dusk"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-60"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-neutral-950 via-neutral-950/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-neutral-950 to-transparent" />

        <div className="container-page flex min-h-[calc(100dvh-4rem)] max-h-[56rem] flex-col justify-center py-24">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">Plano, Texas</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Drive the car you actually want.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-200">
              Thousands of inspected new, certified and pre-owned vehicles with one clear price. Browse online,
              book a test drive in under a minute and let our team handle the rest.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 px-7 text-base">
                <Link href="/cars">
                  Browse Inventory <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 border-white/30 bg-white/5 px-7 text-base text-white backdrop-blur hover:bg-white/15 hover:text-white"
              >
                <Link href="/book">Book a Test Drive</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="NexDrive at a glance" className="border-b bg-neutral-950 text-white">
        <dl className="container-page grid grid-cols-2 gap-y-8 py-10 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col-reverse gap-1 border-white/10 px-2 lg:border-l lg:px-8 lg:first:border-l-0 lg:first:pl-0">
              <dt className="text-sm text-neutral-400">{s.label}</dt>
              <dd className="text-3xl font-semibold tracking-tight">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Featured */}
      <section className="container-page py-20 sm:py-24">
        <SectionHeading
          eyebrow="Featured"
          title="Hand-picked from the lot"
          description="A rotating selection our team would happily drive home themselves."
          action={
            <Button asChild variant="outline" className="h-10 shrink-0 px-5">
              <Link href="/cars">
                View all inventory <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        {featured.length > 0 ? (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((vehicle, i) => (
              <li key={vehicle.vehicle_id}>
                <Reveal delay={Math.min(i, 2) * 0.08} className="h-full">
                  <CarCard vehicle={vehicle} />
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-12">
            <EmptyState
              icon={CarFront}
              title="Featured vehicles are on their way"
              description="Our team is refreshing this selection. The full inventory is available to browse right now."
              action={
                <Button asChild className="h-10 px-5">
                  <Link href="/cars">Browse inventory</Link>
                </Button>
              }
            />
          </div>
        )}
      </section>

      {/* Shop by body type */}
      <section aria-label="Shop by body type" className="border-y bg-muted/40">
        <div className="container-page grid gap-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {BODY_LINKS.map((b) => (
            <Link
              key={b.body}
              href={`/cars?body=${b.body}`}
              className="group flex items-center justify-between rounded-2xl border bg-background px-6 py-5 transition-colors hover:border-neutral-950"
            >
              <span className="text-lg font-semibold tracking-tight">{b.label}</span>
              <ArrowRight
                className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Why NexDrive */}
      <section className="container-page py-20 sm:py-24">
        <SectionHeading
          eyebrow="Why NexDrive"
          title="Car buying, minus the parts everyone dislikes"
          description="We built the dealership we would want to buy from: honest numbers, prepared cars and people who listen."
        />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((r, i) => (
            <li key={r.title}>
              <Reveal delay={i * 0.06} className="h-full rounded-2xl border bg-card p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-neutral-950 text-brand">
                  <r.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{r.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{r.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* Brands */}
      <section aria-labelledby="brands-heading" className="border-y">
        <div className="container-page py-12">
          <h2 id="brands-heading" className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Brands on our lot
          </h2>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {brands.map((brand) => (
              <li key={brand}>
                <Link
                  href={`/cars?make=${encodeURIComponent(brand)}`}
                  className="text-xl font-semibold tracking-tight text-neutral-500 transition-colors hover:text-foreground"
                >
                  {brand}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-page py-20 sm:py-24">
        <SectionHeading eyebrow="Customer stories" title="What our drivers say" align="center" />
        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <li key={t.name}>
              <Reveal delay={i * 0.08} className="h-full">
                <figure className="flex h-full flex-col rounded-2xl border bg-card p-8">
                  <Quote className="size-6 text-brand-ink" aria-hidden="true" />
                  <div className="mt-4 flex gap-0.5" role="img" aria-label="Rated 5 out of 5 stars">
                    {Array.from({ length: 5 }, (_, s) => (
                      <Star key={s} className="size-4 fill-brand text-brand" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-base leading-7">{t.quote}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t pt-6">
                    <span
                      aria-hidden="true"
                      className="grid size-10 place-items-center rounded-full bg-neutral-950 text-sm font-semibold text-white"
                    >
                      {t.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{t.name}</span>
                      <span className="block text-sm text-muted-foreground">{t.detail}</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="container-page pb-20 sm:pb-24">
        <div className="relative isolate overflow-hidden rounded-3xl bg-neutral-950 px-6 py-16 text-white sm:px-16 sm:py-20">
          <Image
            src={SITE_IMAGES.cta}
            alt=""
            fill
            sizes="(min-width: 1280px) 1216px, 100vw"
            className="-z-10 object-cover opacity-35"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-neutral-950/30" />
          <div className="max-w-xl">
            <BadgeCheck className="size-8 text-brand" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Found one you like? Take it for a drive.</h2>
            <p className="mt-4 text-base leading-7 text-neutral-200">
              Choose a time that suits you. We will have the car ready and a specialist on hand to answer every
              question.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 px-7 text-base">
                <Link href="/book">Book a Test Drive</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 border-white/30 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/contact">Talk to our team</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
