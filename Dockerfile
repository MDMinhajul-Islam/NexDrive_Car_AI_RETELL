# syntax=docker/dockerfile:1.7
# NexDrive: Next.js 15 standalone image for Dokploy (or any Docker host).
#
# Build:
#   docker build -t nexdrive \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key> \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com \
#     --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key> .
# Run:
#   docker run -p 3000:3000 \
#     -e WEBSITE_BOOKING_KEY=<secret> -e TURNSTILE_SECRET_KEY=<secret> nexdrive

FROM node:22-alpine AS base
# libc6-compat: glibc shim some native Node addons expect on Alpine (musl).
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: install exactly what package-lock.json pins -----------------------
FROM base AS deps
COPY package.json package-lock.json ./
# Includes the linuxmusl build of sharp, which next/image uses in production.
RUN npm ci --no-audit --no-fund

# ---- builder ----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the JavaScript bundles by `next build`,
# so they must exist NOW. Setting them only at `docker run` has no effect.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

# Fail early with a clear message instead of shipping a bundle with empty values.
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" && test -n "$NEXT_PUBLIC_SITE_URL" \
    || (echo "ERROR: pass NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SITE_URL as --build-arg" && exit 1)

RUN npm run build

# ---- runner -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Standalone server (includes the traced node_modules, sharp among them),
# plus the static assets and public files it does not copy on its own.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The server writes its ISR and optimized-image cache here.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
