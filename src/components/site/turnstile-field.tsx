"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export type TurnstileHandle = TurnstileInstance;

/**
 * Cloudflare Turnstile widget. Rendered only when `enabled` is true; the server decides
 * that with isTurnstileEnabled() and passes it down, so the widget and the server-side
 * check always agree. Tokens are single use: call `ref.current?.reset()` after a failed submit.
 */
export const TurnstileField = forwardRef<
  TurnstileInstance,
  { enabled: boolean; onToken: (token: string) => void; error?: string }
>(function TurnstileField({ enabled, onToken, error }, ref) {
  const box = useRef<HTMLDivElement>(null);
  // "flexible" needs at least 300px. On a 360px phone inside a padded card there is less,
  // so the 150px "compact" widget is used there instead of overflowing the page.
  const [size, setSize] = useState<"flexible" | "compact" | null>(null);
  useEffect(() => {
    if (box.current) setSize(box.current.clientWidth >= 300 ? "flexible" : "compact");
  }, []);

  if (!enabled || !SITE_KEY) return null;
  return (
    <div ref={box} className="w-full min-w-0 space-y-2">
      {size ? (
        <Turnstile
          ref={ref}
          siteKey={SITE_KEY}
          options={{ theme: "light", size, action: "nexdrive_form" }}
          onSuccess={onToken}
          onExpire={() => onToken("")}
          onError={() => onToken("")}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
});
