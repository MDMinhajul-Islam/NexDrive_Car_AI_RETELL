"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <TriangleAlert className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">This page could not be loaded</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again. If it keeps failing, check the Supabase project status.
        </p>
        {error.digest ? <p className="mt-1 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
        <Button className="mt-6 h-9" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Try again
        </Button>
      </div>
    </div>
  );
}
