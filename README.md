# NexDrive

Car dealership website and admin panel for NexDrive (Plano, Texas). It runs on the same Supabase database as the Retell voice agent.

- **Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix), Framer Motion, Supabase (`@supabase/ssr`), TanStack Table, Recharts, React Hook Form, Zod.
- **Public site:** home, inventory with URL-driven filters, vehicle pages, test-drive booking, about, contact.
- **Admin:** `/admin`, protected by middleware, a server-side check and row level security.

## What the admin panel does

| Section | What you can do |
|---|---|
| Dashboard | KPI cards, bookings over time, by status, most booked cars, by weekday or hour, inventory by brand or body type, recent bookings and upcoming test drives. One date range drives every widget |
| Bookings | Search, filter by status, type and date range, sort, page, show or hide columns. Create, view, edit, quick status change, bulk status change, cancel, export CSV |
| Cars | Same table pattern. Create and edit with features and photo upload, mark featured, mark sold, bulk status |
| Customers | Search, filter, sort, view and edit |
| Settings | Account and dealership details |

Rules built in:

- Bookings and vehicles are never hard deleted. A booking is cancelled and a vehicle is marked Sold.
- Tables load one page at a time. Search, filters, sorting and paging run in Postgres, and so do all dashboard totals.
- The CSV export is generated on the server from the current filters, not from the visible page.
- Every admin Server Action checks the admin role again, and row level security enforces it in the database.

## Requirements

- Node.js 22 or newer and npm
- A Supabase project (this one already exists)
- Optional: a Cloudflare Turnstile widget (free) for spam protection
- Docker, only if you deploy with the Dockerfile

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:types` | Regenerate `src/types/database.ts` (needs `npx supabase login`) |

## Environment variables

| Variable | Where it is used | Kind |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public, build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon or publishable key | Public, build time |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, Open Graph. No trailing slash | Public, build time |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget on booking and contact forms | Public, build time |
| `WEBSITE_BOOKING_KEY` | Shared secret sent to Postgres when creating a booking | Server secret, runtime |
| `TURNSTILE_SECRET_KEY` | Verifies Turnstile tokens in Server Actions | Server secret, runtime |

Rules that matter:

- `NEXT_PUBLIC_*` values are inlined into the JavaScript at **build** time. Changing them needs a rebuild.
- The two server secrets are read at **runtime** and never reach the browser.
- The Supabase **service role key is not used anywhere**. Do not add it.
- Turnstile is optional. It is on only when both Turnstile keys are set. With `TURNSTILE_SECRET_KEY` empty the check is skipped and the widget is hidden.

## Database setup

The SQL lives in `supabase/proposed/`. Nothing is applied automatically. Run each file in the Supabase SQL editor, in order. Files 01 to 09 are already applied to the NexDrive project. Do not edit an applied file: put later changes in a new numbered file.

| File | Purpose |
|---|---|
| `00_inspect_readonly.sql`, `00b_inspect_followup_readonly.sql` | Read-only reports. They change nothing |
| `01_profiles_admin_role.sql` | `profiles` table, `is_admin()`, new-user trigger |
| `02_rls_policies.sql` | Public read of catalogue tables, admin access. No delete on appointments or vehicles |
| `03_schema_additions.sql` | `vehicles.is_featured`, `contact_messages`, admin create functions |
| `04_dashboard_functions.sql` | Dashboard aggregation in America/Chicago |
| `05_storage.sql` | Admin write policies for the existing `vehicle-images` bucket |
| `06_create_test_drive_website.sql` | First version of the website booking function (superseded by 07) |
| `07_fixes.sql` | Website key check, website customer, lead and booking functions, updated admin booking function, grants and a verification query |
| `08_revoke_anon_admin_functions.sql` | Removes the anon execute grant from admin and dashboard functions |
| `09_upcoming_rule.sql` | "Upcoming appointment" now also requires a date of today or later (US Central) |

### Website booking key

The three website functions refuse any caller that does not send the website key, so they cannot be called from a browser.

1. Generate a key: `openssl rand -hex 32`
2. Put it in `WEBSITE_BOOKING_KEY` (in `.env.local`, and in your host's environment).
3. Store the same value in Supabase Vault, once:

```sql
select vault.create_secret(
  '<the same value>',
  'website_booking_key',
  'Shared secret between the NexDrive website and booking functions');
```

This key is separate from the Retell key. Never reuse one for the other.

### Create an admin user

1. Supabase dashboard, Authentication, Users, **Add user**. Enter an email and password and tick auto-confirm.
2. Promote the user in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

3. Sign in at `/admin/login`.

Everyone else is redirected away from `/admin`, including signed-in users without the admin role.

## Spam protection

- **Cloudflare Turnstile** on the booking and contact forms, when enabled. The token is verified in the Server Action before any database call. It is optional: leave `TURNSTILE_SECRET_KEY` empty to turn it off.
- **Per-IP rate limits** on Server Actions, always on: 5 bookings and 5 contact messages per 10 minutes, plus looser limits on slot lookups, vehicle search and admin sign-in.
- The rate limiter is in memory. It suits one container. With several replicas, move it to a shared store such as Redis.
- A hidden honeypot field on both forms.

To get keys: Cloudflare dashboard, Turnstile, **Add widget**, add your domain (and `localhost` for local testing).

## Project structure

```
src/
  app/
    (site)/          public pages
    admin/           login and the protected panel
    actions/         Server Actions (all mutations); actions/admin for the panel
    api/health/      liveness probe
  components/        ui (shadcn), site, admin
  lib/
    supabase/        browser, server and middleware clients
    data/            server-side queries; data/admin for the panel
    admin/           URL table params and time slots
    security/        rate limit, Turnstile, client IP
    validations/     Zod schemas mirroring the DB check constraints
  types/database.ts  generated Supabase types
supabase/proposed/   SQL for review
```

Conventions:

- All dates and times are shown in **America/Chicago**.
- Inventory filtering, sorting and pagination run in Postgres. The browser never loads a full table.
- Appointments and vehicles are never hard deleted. Cancel the appointment or mark the vehicle Sold.
- Hosts that `next/image` may optimize are listed in `image-hosts.json`. Photos from other hosts still render, unoptimized.
- Vehicle photos resolve in this order: uploads in `vehicle_images`, the stock photo in `vehicle_model_images`, then a body-type fallback.

## Docker

The image is a multi-stage build on `node:22-alpine` using Next.js standalone output. It runs as a non-root user on port 3000.

```bash
docker build -t nexdrive \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key> \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key> \
  .

docker run -p 3000:3000 \
  -e WEBSITE_BOOKING_KEY=<secret> \
  -e TURNSTILE_SECRET_KEY=<secret> \
  nexdrive
```

- The build stops with a clear error if a required `NEXT_PUBLIC_*` build arg is missing.
- `GET /api/health` returns 200 and does not touch the database. The image has a `HEALTHCHECK` that uses it.
- `sharp` is installed for `next/image` optimization.

## Deploy on Dokploy

1. **Create the application.** In your Dokploy project choose Create Service, Application, and connect the Git repository and branch.
2. **Build Type.** Select **Dockerfile**. Docker File is `Dockerfile` and Docker Context Path is `.`
3. **Build Args.** In the Environment tab, add these under *Build-time Arguments*. They are inlined during `next build`.

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
   NEXT_PUBLIC_SITE_URL=https://your-domain.com
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>
   ```

4. **Environment.** Add the server secrets under *Environment Settings*. They are read at runtime.

   ```
   WEBSITE_BOOKING_KEY=<same value as the Vault secret>
   TURNSTILE_SECRET_KEY=<secret key>
   ```

   Do not put secrets in Build Args. Build args are visible in the image history.
5. **Port.** The container listens on **3000**.
6. **Domain.** In the Domains tab add your host, set Container Port to `3000`, enable HTTPS and choose Let's Encrypt. Point a DNS A record at the server first.
7. **Health check.** Path `/api/health`, port `3000`. The Dockerfile `HEALTHCHECK` already reports status. For zero-downtime deploys, add the same check under Advanced, Swarm Settings.
8. **Deploy**, then open the domain.

After deploying:

- Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS domain, and redeploy if you change it. It is baked into the build.
- Add the domain to the Turnstile widget's hostname list.
- In Supabase, Authentication, URL Configuration, set Site URL to the domain.
- Keep the app at **one replica** while the rate limiter is in memory.
- Dokploy's proxy forwards the visitor address in `X-Forwarded-For`, which the rate limiter reads.

## Deploy on Vercel

1. Import the repository in Vercel. The framework preset is Next.js.
2. Add all six environment variables under Settings, Environment Variables.
3. Deploy. `output: "standalone"` is ignored by Vercel and does no harm.

On Vercel the in-memory rate limiter is per function instance, so treat it as best effort and rely on Turnstile.

## Before launch

- Replace the sample testimonials on the home page with real customer reviews.
- Replace the placeholder phone, email and address in `src/lib/constants.ts`.
- Swap the map placeholder on the contact page for an embedded map.
- Stock model photos are loaded from third-party sites (`vehicle_model_images.image_url`). They can be slow or disappear. Upload real photos per vehicle in Admin, Cars, or copy the stock photos into the `vehicle-images` bucket.
- Sign in to the admin panel and walk through each section once with real data.
