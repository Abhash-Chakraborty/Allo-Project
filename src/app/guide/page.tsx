import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumb } from "@/components/breadcrumb";

export const metadata = { title: "Guide" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-display-md mb-6 pb-3 border-b border-hairline-light">{title}</h2>
      {children}
    </section>
  );
}

function Problem({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-start gap-4 mb-3">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-canvas-night text-on-primary flex items-center justify-center text-caption font-bold">
          {n}
        </span>
        <h3 className="text-heading-lg pt-1">{title}</h3>
      </div>
      <div className="ml-12 space-y-3 text-body-md text-shade-60 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-canvas-night text-link-cool-3 rounded-lg p-4 text-[13px] font-mono overflow-x-auto my-4 leading-relaxed">
      {children}
    </pre>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="inline-block bg-shade-30 text-ink rounded px-2 py-0.5 text-caption font-mono mr-1">
      {children}
    </span>
  );
}

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-canvas-cream text-ink">
        {/* Hero band */}
        <div className="bg-canvas-night text-on-primary py-12 px-6">
          <div className="mx-auto max-w-[860px]">
            <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: "Guide" }]} />
            <h1 className="text-display-lg mb-4">How Allo was built</h1>
            <p className="text-body-lg text-link-cool-3 max-w-2xl">
              A walkthrough of every problem the assignment posed, the approach I took,
              and the specific decisions that make the solution correct under concurrency.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-6 py-12 md:py-16">

          {/* ── 1. Data model ─────────────────────────────────────────── */}
          <Section title="1. Data model for inventory and reservations">
            <p className="text-body-md text-shade-60 mb-6 leading-relaxed">
              The schema has five tables. The key insight is separating <em>catalogue</em> (products)
              from <em>stock</em> (inventory) and from <em>holds</em> (reservations).
            </p>

            <Problem n={1} title="How do you track available stock without a race?">
              <p>
                Each <Tag>inventory</Tag> row stores <Tag>total_units</Tag> and <Tag>reserved_units</Tag>.
                Available stock is always <code>total_units − reserved_units</code> — computed at query
                time, never stored. A <Tag>CHECK</Tag> constraint enforces{" "}
                <code>reserved_units ≤ total_units</code> at the database level as a hard backstop.
              </p>
              <p>
                This means the database itself will reject any update that would oversell, even if
                application logic has a bug.
              </p>
            </Problem>

            <Problem n={2} title="Why a separate reservations table instead of decrementing stock immediately?">
              <p>
                Decrementing on add-to-cart and incrementing on abandon is fragile — abandoned carts
                never reliably trigger cleanup. Instead, a reservation is a <em>time-bounded hold</em>:
                stock is logically unavailable but not yet sold. The transition is:
              </p>
              <Code>{`pending  →  confirmed   (payment succeeded, stock permanently decremented)
pending  →  released    (customer cancelled, units returned)
pending  →  expired     (TTL elapsed, units returned by cron)`}</Code>
              <p>
                The <Tag>idempotency_keys</Tag> table deduplicates POST requests so retried payments
                never double-charge or double-reserve.
              </p>
            </Problem>
          </Section>

          {/* ── 2. Race-free API ──────────────────────────────────────── */}
          <Section title="2. Race-free reservation API">
            <p className="text-body-md text-shade-60 mb-6 leading-relaxed">
              The hardest part of the assignment: two concurrent requests for the last unit must
              result in exactly one success and one <Tag>409 insufficient_stock</Tag>.
            </p>

            <Problem n={3} title="The concurrency problem">
              <p>
                Without locking, two requests can both read <code>available = 1</code>, both decide
                to proceed, and both insert a reservation — overselling by one unit. This is a classic
                TOCTOU (time-of-check / time-of-use) race.
              </p>
            </Problem>

            <Problem n={4} title="Solution: SELECT FOR UPDATE inside a stored function">
              <p>
                All reservation logic runs inside a single Postgres transaction in{" "}
                <Tag>reserve_units()</Tag>. The critical section:
              </p>
              <Code>{`-- Acquires a row-level lock. Concurrent callers block here.
SELECT * FROM inventory
 WHERE product_id = $1 AND warehouse_id = $2
 FOR UPDATE;

-- Only one transaction holds the lock at a time.
-- Re-check availability with fresh data:
IF available_units < requested_qty THEN
  RAISE EXCEPTION 'insufficient_stock';
END IF;

UPDATE inventory
   SET reserved_units = reserved_units + requested_qty
 WHERE product_id = $1 AND warehouse_id = $2;

INSERT INTO reservations (...) RETURNING *;`}</Code>
              <p>
                With N concurrent requests for the last unit, the first acquires the lock and commits.
                The remaining N−1 wake up, re-read the now-updated count, and raise{" "}
                <Tag>insufficient_stock</Tag>. No Redis, no application-level mutex, no race window.
              </p>
            </Problem>

            <Problem n={5} title="Why a stored function instead of application-layer transactions?">
              <p>
                A stored function runs entirely inside Postgres. There is no network round-trip
                between the lock acquisition and the update — the lock is held for microseconds.
                An application-layer transaction would hold the lock across two network hops
                (read → application logic → write), dramatically increasing contention under load.
              </p>
            </Problem>

            <Problem n={6} title="Idempotency">
              <p>
                POST endpoints accept an <Tag>Idempotency-Key</Tag> header. The first request claims
                the key (status 0 = in-flight), runs the handler, then stores the response. A retry
                with the same key replays the stored response with <Tag>Idempotent-Replay: true</Tag>.
                A different body with the same key returns <Tag>409 idempotency_conflict</Tag>.
                An in-flight duplicate polls for up to 5 s then returns <Tag>425</Tag>.
              </p>
            </Problem>
          </Section>

          {/* ── 3. Frontend ───────────────────────────────────────────── */}
          <Section title="3. Frontend">
            <Problem n={7} title="Product listing — paginated grid">
              <p>
                Products are fetched server-side (Next.js App Router, <Tag>force-dynamic</Tag>).
                The grid renders 21 items initially; a "Load more" button reveals the next batch
                client-side from the already-fetched array — no extra network request.
                Cards animate in with a staggered fade using <Tag>motion/react</Tag>.
              </p>
            </Problem>

            <Problem n={8} title="Product detail — sticky reserve panel">
              <p>
                The detail page shows stock broken down by warehouse. The reserve panel is sticky
                on desktop. Clicking "Reserve" opens a modal that calls{" "}
                <Tag>POST /api/reservations</Tag> and redirects to the checkout page on success.
                The modal closes on Escape or outside click — no close button per design spec.
              </p>
            </Problem>

            <Problem n={9} title="Checkout — realtime countdown">
              <p>
                The checkout page subscribes to the reservation row via Supabase Realtime. If the
                reservation is confirmed or released from another tab, the UI updates instantly.
                A 5-second polling fallback handles environments where WebSockets are blocked.
                The countdown timer ticks client-side from <Tag>expires_at</Tag>.
              </p>
            </Problem>
          </Section>

          {/* ── 4. Expiry ─────────────────────────────────────────────── */}
          <Section title="4. Reservation expiry — three layers">
            <p className="text-body-md text-shade-60 mb-6 leading-relaxed">
              A reservation that is never confirmed or released must eventually free its units.
              Three independent mechanisms ensure this:
            </p>

            <Problem n={10} title="Layer 1 — Vercel Cron">
              <p>
                <Tag>vercel.json</Tag> schedules <Tag>GET /api/cron/expire-reservations</Tag> every
                minute. The handler calls <Tag>expire_reservations()</Tag> which bulk-updates all
                rows where <code>status = &apos;pending&apos;</code> and{" "}
                <code>expires_at ≤ now()</code>, returning reserved units to inventory.
              </p>
            </Problem>

            <Problem n={11} title="Layer 2 — Lazy expiry on read">
              <p>
                Every <Tag>GET /api/reservations/:id</Tag> call checks the timestamp inline and
                expires the reservation if needed before returning. This means a reservation is
                never served as "pending" after its TTL, even if the cron hasn't run yet.
              </p>
            </Problem>

            <Problem n={12} title="Layer 3 — Lazy expiry on confirm">
              <p>
                <Tag>confirm_reservation()</Tag> re-checks <Tag>expires_at</Tag> inside the same
                lock that decrements stock. A payment that races the expiry timer cannot succeed
                against a stale hold — the function raises <Tag>reservation_expired</Tag> and the
                stock is never decremented.
              </p>
            </Problem>
          </Section>

          {/* ── Bonus ─────────────────────────────────────────────────── */}
          <Section title="Bonus: what was added beyond the spec">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                ["Live video-to-ASCII hero", "The hero section renders a looping video as coloured ASCII art in real time using a canvas-based renderer — no library, ~150 lines."],
                ["Cinematic design system", "Custom Tailwind v4 design tokens: canvas-night / canvas-cream tracks, display type scale, pill buttons, elevation shadows."],
                ["106 seeded products", "Four warehouses (blr-01, del-01, mum-01, hyd-01) with category-matched Unsplash images for every product."],
                ["Docs page with ISR", "/docs fetches the README from GitHub and renders it as markdown with 1-hour ISR — always up to date without a redeploy."],
                ["Security hardening", "Supabase advisor issues resolved: inventory view recreated with security_invoker = true, EXECUTE revoked from anon/public on internal functions."],
                ["CDN caching", "hero.mp4 served with Cache-Control: public, max-age=31536000, immutable via Vercel Edge Network. Browser preload hint in <head>."],
              ].map(([title, desc]) => (
                <div key={title} className="card p-6">
                  <h4 className="text-heading-sm mb-2">{title}</h4>
                  <p className="text-body-md text-shade-60 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Trade-offs ────────────────────────────────────────────── */}
          <Section title="Honest trade-offs">
            <div className="space-y-4">
              {[
                ["No auth", "Reservation IDs are UUID v4 (not enumerable), but in production reservations would be attached to authenticated users."],
                ["No RLS", "The anon Supabase key can read all tables. Required for Realtime to work without auth. Production would add row-level security policies."],
                ["No tests", "A production PR would include a Postgres concurrency test (10 connections, 10 concurrent reserve_units calls for the last unit, assert exactly 1 succeeds) and Playwright E2E tests."],
                ["Idempotency key TTL", "Keys live forever in this demo. Production would prune rows older than 24 h."],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-4 py-4 border-b border-hairline-light last:border-0">
                  <span className="text-heading-sm w-40 flex-shrink-0">{title}</span>
                  <p className="text-body-md text-shade-60 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
