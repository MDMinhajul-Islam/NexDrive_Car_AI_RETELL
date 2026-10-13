import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { SITE } from "@/lib/constants";

const SHOP = [
  { href: "/cars", label: "All inventory" },
  { href: "/cars?condition=New", label: "New vehicles" },
  { href: "/cars?condition=Certified+Pre-Owned", label: "Certified pre-owned" },
  { href: "/cars?condition=Used", label: "Used vehicles" },
  { href: "/cars?fuel=Electric", label: "Electric vehicles" },
];
const COMPANY = [
  { href: "/about", label: "About NexDrive" },
  { href: "/book", label: "Book a test drive" },
  { href: "/contact", label: "Contact us" },
  { href: "/admin/login", label: "Staff sign in" },
];

export function Footer() {
  const { address } = SITE;
  return (
    <footer className="bg-neutral-950 text-neutral-300">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo className="text-white" />
          <p className="max-w-xs text-sm leading-6 text-neutral-400">
            Inspected vehicles, clear pricing and a team that respects your time. Proudly serving Plano and
            the Dallas-Fort Worth area.
          </p>
        </div>

        <nav aria-label="Shop">
          <h2 className="text-sm font-semibold text-white">Shop</h2>
          <ul className="mt-4 space-y-0 text-sm md:space-y-3">
            {SHOP.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="tap-link transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="text-sm font-semibold text-white">Company</h2>
          <ul className="mt-4 space-y-0 text-sm md:space-y-3">
            {COMPANY.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="tap-link transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-white">Visit us</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <address className="not-italic">
                {address.street}
                <br />
                {address.city}, {address.state} {address.zip}
              </address>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <a href={`tel:${SITE.phone}`} className="tap-link hover:text-white">
                {SITE.phoneDisplay}
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <a href={`mailto:${SITE.email}`} className="tap-link hover:text-white">
                {SITE.email}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <ul className="space-y-1">
                {SITE.hours.map((h) => (
                  <li key={h.days}>
                    <span className="text-neutral-400">{h.days}:</span> {h.time}
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <p>Prices exclude tax, title, license and dealer fees. Financing subject to lender approval.</p>
        </div>
      </div>
    </footer>
  );
}
