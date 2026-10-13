"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarCheck,
  CarFront,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/cars", label: "Cars", icon: CarFront },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavContent({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Admin" className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white",
                active && "bg-white/10 text-white",
              )}
            >
              <item.icon className={cn("size-4", active && "text-brand")} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 px-3 py-4">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          View website
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-300 hover:bg-white/5 hover:text-white disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
          Logout
        </button>
        <p className="truncate px-3 pt-2 text-xs text-neutral-400" title={email}>
          {email}
        </p>
      </div>
    </div>
  );
}

export function AdminSidebar({ email }: { email: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-neutral-950 text-white lg:fixed lg:inset-y-0 lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-6">
        <Logo />
      </div>
      <NavContent email={email} />
    </aside>
  );
}

export function AdminMobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-neutral-950 px-4 text-white lg:hidden">
      <Logo />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-white hover:bg-white/10 hover:text-white"
            aria-label="Open admin menu"
          >
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-white/10 bg-neutral-950 p-0 text-white">
          <SheetHeader className="border-b border-white/10">
            <SheetTitle className="text-white">Admin menu</SheetTitle>
          </SheetHeader>
          <NavContent email={email} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
