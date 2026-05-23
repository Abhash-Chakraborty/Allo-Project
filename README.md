# Allo — Inventory Reservation System

Live: **[allo.abhashchakraborty.tech](https://allo.abhashchakraborty.tech)**

A full-stack inventory reservation application that holds stock units for a fixed window while customers complete payment, then either confirms (permanently decrements stock) or releases (returns units to availability) the hold.

The core guarantee: **two concurrent carts can never claim the same unit.** This is enforced at the Postgres layer via row-level locks inside stored functions — not at the application layer.

---

## What it does

### 1. Data model

```
products          — catalogue items with price and description
warehouses        — fulfilment locations (blr-01, del-01, mum-01, hyd-01)
inventory         — (product, warehouse) stock with reserved_units counter
reservations      — holds with status: pending → confirmed | released | expired
idempotency_keys  — deduplication table for POST endpoints
```

A `CHECK` constraint on `inventory` enforces `reserved_units ≤ total_units` at the database level as a backstop.

### 2. API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products with stock |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Create a hold (race-free) |
| GET | `/api/reservations/:id` | Get reservation status |
| POST | `/api/reservations/:id/confirm` | Confirm purchase |
| POST | `/api/reservations/:id/release` | Release hold |
| GET | `/api/cron/expire-reservations` | Sweep expired holds (cron) |

All routes return `Cache-Control: no-store`. Errors follow `{ error: { code, message } }`.

### 3. Frontend

- **Home** — cinematic hero with live video-to-ASCII renderer, featured products
- **Products** (`/products`) — paginated grid (21 items + load more), animated cards
- **Product detail** (`/products/[id]`) — image, stock by warehouse, sticky reserve panel, similar products
- **Checkout** (`/reservations/[id]`) — countdown timer, realtime status via Supabase Realtime + 5s polling fallback, confirm/release actions
- **Docs** (`/docs`) — README rendered from GitHub with ISR

### 4. Reservation expiry — three layers

1. **Vercel Cron** — hits `GET /api/cron/expire-reservations` every minute
2. **Lazy expiry on read** — every reservation fetch checks `expires_at ≤ now()` and expires inline
3. **Lazy expiry on confirm** — `confirm_reservation` checks the timestamp inside the lock; a payment racing the timer cannot succeed against a stale hold

---

## Concurrency model

The invariant: `reserved_units ≤ total_units` per inventory row.

```sql
-- Inside reserve_units(), all in one transaction:
SELECT * FROM inventory
 WHERE product_id = $1 AND warehouse_id = $2
 FOR UPDATE;                          -- serialises concurrent reservers

-- check availability, then:
UPDATE inventory SET reserved_units = reserved_units + $qty ...;
INSERT INTO reservations ...;
```

With N concurrent requests for the last unit, the first acquires the lock and commits. The remaining N−1 wake up, see the updated count, and receive `409 insufficient_stock`. No application-level locking, no Redis, no race window.

---

## Idempotency

`POST /api/reservations` and `POST /api/reservations/:id/confirm` honour an `Idempotency-Key` header.

- First request: claims the key with `status_code = 0`, runs the handler, stores the response
- Repeat with same key + same body: replays the stored response with `Idempotent-Replay: true`
- Same key + different body: `409 idempotency_conflict`
- In-flight duplicate: polls up to 5 s, then `425 idempotency_in_progress`

---

## Stack

- **Next.js 16** (App Router, Turbopack, React 19) — TypeScript end-to-end
- **Supabase** (Postgres) — `@supabase/supabase-js`, no ORM
- **Tailwind CSS v4** — custom design tokens
- **Zod** — request validation
- **Vercel Cron** — expiry sweeper

---

## Quickstart

```bash
pnpm install

cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET

pnpm dev   # http://localhost:3000
```

### Provisioning Supabase

```bash
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed.sql
```

Or run the migration files manually in the SQL Editor in order:
1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_functions.sql`
3. `supabase/migrations/0003_realtime.sql`
4. `supabase/seed.sql`

---

## Project layout

```
src/
  app/
    page.tsx                        # Home — hero + featured products
    products/page.tsx               # Product listing
    products/[id]/page.tsx          # Product detail + reserve
    reservations/[id]/page.tsx      # Checkout countdown
    docs/page.tsx                   # README viewer
    api/
      products/route.ts
      warehouses/route.ts
      reservations/route.ts
      reservations/[id]/route.ts
      reservations/[id]/confirm/route.ts
      reservations/[id]/release/route.ts
      cron/expire-reservations/route.ts
  components/
    site-header.tsx
    site-footer.tsx
    product-grid.tsx
    product-card.tsx
    reserve-button.tsx
    reservation-view.tsx
    video-ascii.tsx                 # Live video → coloured ASCII renderer
  lib/
    supabase/server.ts              # Service-role client
    supabase/browser.ts             # Anon client (realtime)
    schemas.ts                      # Zod schemas
    types.ts                        # API DTOs
    api-error.ts                    # Postgres error → HTTP mapping
    idempotency.ts                  # withIdempotency helper
    data.ts                         # listProducts / getProductWithStock / …
    format.ts                       # INR / mm:ss / UUID

supabase/
  migrations/
    0001_schema.sql
    0002_functions.sql
    0003_realtime.sql
  seed.sql

vercel.json                         # Cron schedule + CDN headers
.env.example
```

---

## Deployment

Vercel + Supabase. Set the five env vars from `.env.example` in **Project Settings → Environment Variables**. After the first deploy, Vercel's Cron tab will show `GET /api/cron/expire-reservations` running every minute.

For other hosts: replace `vercel.json` cron with any scheduler hitting the same URL with `Authorization: Bearer ${CRON_SECRET}`.

---

## Trade-offs

- **No auth.** Reservation IDs are random UUID v4s (not enumerable), but in production you'd attach reservations to users and authorize accordingly.
- **No RLS.** The anon Supabase key can read everything. Necessary for realtime to work without auth; in production every table would have RLS policies.
- **No tests.** A production PR would include a Postgres-level concurrency test (spawn 10 connections, fire 10 `reserve_units` for the last unit, assert exactly 1 succeeds) and Playwright tests for the user flow.
- **Idempotency key cleanup.** Keys live forever in this demo. Production would prune rows older than 24 h using the `idempotency_keys_created_idx` index.
