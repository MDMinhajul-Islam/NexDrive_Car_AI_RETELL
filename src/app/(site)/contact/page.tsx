import type { Metadata } from "next";
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { PageHeader } from "@/components/site/section";
import { SITE } from "@/lib/constants";
import { isTurnstileEnabled } from "@/lib/security/turnstile";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Call, email or visit NexDrive in Plano, Texas. Ask about a vehicle, financing, a trade-in or your test drive and we will reply within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact NexDrive", url: "/contact" },
};

// Rendered per request so the Turnstile on/off decision reads the runtime secret,
// not whatever was set when the image was built.
export const dynamic = "force-dynamic";

export default function ContactPage() {
  const { address } = SITE;
  const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="We are here to help"
        description="Questions about a vehicle, financing or a trade-in? Send a message and a specialist will reply within one business day."
      />

      <div className="container-page grid grid-cols-1 gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:py-16">
        <section aria-labelledby="contact-form-heading" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-8">
          <h2 id="contact-form-heading" className="mb-6 text-xl font-semibold tracking-tight">
            Send us a message
          </h2>
          <ContactForm turnstileEnabled={isTurnstileEnabled()} />
        </section>

        <aside aria-label="Contact details" className="space-y-6">
          <ul className="space-y-6 rounded-2xl border bg-card p-6 text-sm">
            <li className="flex gap-4">
              <MapPin className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Showroom</h2>
                <address className="mt-1 not-italic leading-6 text-muted-foreground">
                  {address.street}
                  <br />
                  {address.city}, {address.state} {address.zip}
                </address>
              </div>
            </li>
            <li className="flex gap-4">
              <Phone className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Phone</h2>
                <a href={`tel:${SITE.phone}`} className="tap-link mt-1 text-muted-foreground hover:text-foreground md:block">
                  {SITE.phoneDisplay}
                </a>
              </div>
            </li>
            <li className="flex gap-4">
              <Mail className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Email</h2>
                <a href={`mailto:${SITE.email}`} className="tap-link mt-1 text-muted-foreground hover:text-foreground md:block">
                  {SITE.email}
                </a>
              </div>
            </li>
            <li className="flex gap-4">
              <Clock className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Hours (US Central)</h2>
                <dl className="mt-1 space-y-1 text-muted-foreground">
                  {SITE.hours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-6">
                      <dt>{h.days}</dt>
                      <dd className="text-right">{h.time}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          </ul>
        </aside>
      </div>

      {/* Map placeholder: swap for an embedded map when an API key is available. */}
      <section aria-labelledby="map-heading" className="container-page pb-16 lg:pb-24">
        <h2 id="map-heading" className="sr-only">
          Map
        </h2>
        <div
          role="img"
          aria-label={`Map placeholder showing the NexDrive showroom at ${fullAddress}`}
          className="relative grid h-80 place-items-center overflow-hidden rounded-3xl border bg-neutral-100"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(0 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/95 px-8 py-6 text-center shadow-lg">
            <span className="grid size-12 place-items-center rounded-full bg-neutral-950 text-brand">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold">NexDrive Plano Flagship</p>
            <p className="text-sm text-muted-foreground">{fullAddress}</p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4"
            >
              <Navigation className="size-4" aria-hidden="true" />
              Get directions
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
