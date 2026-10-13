"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

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
  if (!enabled || !SITE_KEY) return null;
  return (
    <div className="space-y-2">
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        options={{ theme: "light", size: "flexible", action: "nexdrive_form" }}
        onSuccess={onToken}
        onExpire={() => onToken("")}
        onError={() => onToken("")}
      />
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
});
