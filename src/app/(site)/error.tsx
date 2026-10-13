"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-24 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
          We hit an unexpected problem loading this page. Please try again, and if it keeps happening give us a
          call.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset} className="h-11 px-6 text-base">
            <RotateCcw aria-hidden="true" /> Try again
          </Button>
          <Button asChild variant="outline" className="h-11 px-6 text-base">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
