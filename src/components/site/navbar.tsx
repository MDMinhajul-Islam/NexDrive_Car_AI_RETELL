"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/site/logo";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/cars", label: "Inventory" },
  { href: "/book", label: "Book a Test Drive" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/95 text-white backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink"
      >
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white",
                isActive(link.href) && "text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${SITE.phone}`}
            className="hidden items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-300 transition-colors hover:text-white lg:inline-flex"
          >
            <Phone className="size-4" aria-hidden="true" />
            {SITE.phoneDisplay}
          </a>
          <Button
            asChild
            variant="outline"
            className="h-11 border-white/20 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white md:h-9"
          >
            <Link href="/admin/login">
              <ShieldCheck aria-hidden="true" />
              Admin
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className="size-11 text-white hover:bg-white/10 hover:text-white md:hidden"
                aria-label="Open menu"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,85vw)] overflow-y-auto border-white/10 bg-neutral-950 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white">
              <SheetHeader>
                <SheetTitle className="text-white">Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-3 text-base font-medium text-neutral-300 hover:bg-white/5 hover:text-white",
                      isActive(link.href) && "bg-white/5 text-white",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <a
                  href={`tel:${SITE.phone}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-md px-3 py-3 text-base text-neutral-300 hover:text-white"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  {SITE.phoneDisplay}
                </a>
                <Button
                  asChild
                  variant="outline"
                  className="mt-2 h-12 justify-start border-white/20 bg-transparent px-3 text-base text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/admin/login" onClick={() => setOpen(false)}>
                    <ShieldCheck aria-hidden="true" />
                    Admin
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
