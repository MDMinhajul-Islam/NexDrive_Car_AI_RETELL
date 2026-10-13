"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True when a site key was provided at build time. Without one the widget is not rendered. */
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

export type TurnstileHandle = TurnstileInstance;

/**
 * Cloudflare Turnstile widget. Tokens are single use, so call `ref.current?.reset()`
 * after every failed submit.
 */
export const TurnstileField = forwardRef<
  TurnstileInstance,
  { onToken: (token: string) => void; error?: string }
>(function TurnstileField({ onToken, error }, ref) {
  if (!SITE_KEY) return null;
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
