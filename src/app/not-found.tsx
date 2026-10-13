import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main id="main" className="grid flex-1 place-items-center bg-neutral-950 px-4 py-24 text-center text-white">
        <div>
          <p className="font-mono text-sm text-brand">Error 404</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">Wrong turn.</h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-neutral-300">
            The page you are looking for has moved, sold or never existed. The rest of the lot is still open.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="h-12 px-7 text-base">
              <Link href="/cars">
                Browse Inventory <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 border-white/30 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
