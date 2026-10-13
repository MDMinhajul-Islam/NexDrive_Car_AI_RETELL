import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClipboardCheck, Handshake, Scale, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/site/reveal";
import { PageHeader, SectionHeading } from "@/components/site/section";
import { SITE_IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "About us",
  description:
    "NexDrive is a Plano, Texas dealership built around inspected vehicles, one clear price and a team that respects your time.",
  alternates: { canonical: "/about" },
  openGraph: { title: "About NexDrive", url: "/about" },
};

const VALUES = [
  {
    icon: Scale,
    title: "Honest numbers",
    body: "Our online price is our real price. Fees are listed before you visit, and financing terms are explained in plain language.",
  },
  {
    icon: ClipboardCheck,
    title: "Prepared vehicles",
    body: "Every car is inspected and reconditioned before it is listed. If it is not ready for a test drive, we say so on the listing.",
  },
  {
    icon: Users,
    title: "Specialists, not closers",
    body: "Our team includes SUV, truck, EV and certified pre-owned specialists who help you compare rather than push you to sign.",
  },
  {
    icon: Handshake,
    title: "Here after the sale",
    body: "Warranty questions, service scheduling and trade-in appraisals are handled by the same people who sold you the car.",
  },
];

const STEPS = [
  { step: "01", title: "Browse", body: "Filter the full inventory by brand, body type, budget and more. Every listing shows live status." },
  { step: "02", title: "Book", body: "Reserve a 30-minute test drive online. We match you with a specialist for that vehicle." },
  { step: "03", title: "Drive", body: "Arrive to a car that is ready to go. Take your time and ask anything." },
  { step: "04", title: "Decide", body: "Review price, trade-in value and financing options side by side. No pressure, no surprises." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About NexDrive"
        title="A dealership designed around the driver"
        description="We started NexDrive with a simple idea: buying a car should feel as good as driving one."
      />

      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-neutral-100">
            <Image
              src={SITE_IMAGES.about}
              alt="A car being prepared inside the NexDrive service bay"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </Reveal>
        <div className="space-y-6">
          <SectionHeading eyebrow="Our story" title="Built in Plano for North Texas drivers" />
          <div className="space-y-4 text-base leading-7 text-muted-foreground">
            <p>
              NexDrive brings new, certified pre-owned and used vehicles together under one roof, with a single
              inventory you can search from your phone. Whether you need a first car, a family SUV or a work truck,
              the listing you see online reflects what is actually on the lot.
            </p>
            <p>
              We serve customers across Texas from our Plano flagship, and our team works in English, Spanish, Hindi
              and Urdu. Sedans, SUVs, trucks and hatchbacks, gasoline, hybrid and fully electric: if it is in our
              inventory, it has been inspected and priced clearly.
            </p>
            <p>
              Technology helps us move faster, from online booking to round-the-clock phone support, but the part
              that matters most has not changed. You get straight answers from people who know cars.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40">
        <div className="container-page py-16 lg:py-24">
          <SectionHeading eyebrow="What we stand for" title="Four promises we keep" align="center" />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <li key={v.title}>
                <Reveal delay={i * 0.06} className="flex h-full gap-5 rounded-2xl border bg-card p-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-neutral-950 text-brand">
                    <v.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{v.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{v.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-16 lg:py-24">
        <SectionHeading eyebrow="How it works" title="From browsing to driving home" />
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.step} className="border-t-2 border-neutral-950 pt-6">
              <p className="font-mono text-sm text-brand-ink">{s.step}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 px-6 text-base">
            <Link href="/cars">Browse Inventory</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-6 text-base">
            <Link href="/book">Book a Test Drive</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
