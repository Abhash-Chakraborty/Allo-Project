// Home page
import Image from "next/image";
import Link from "next/link";

import { listProducts } from "@/lib/data";
import { formatPrice } from "@/lib/format";

import { VideoAscii } from "@/components/video-ascii";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  try {
    products = await listProducts();
  } catch {
    // show hero even if DB is down
  }

  const featured = products.slice(0, 3);

  return (
    <>
      <SiteHeader />

      {/* ── Cinematic hero ─────────────────────────────────────────── */}
      <section className="bg-canvas-night text-on-primary min-h-[calc(100vh-64px)] flex items-center">
        <div className="mx-auto max-w-[1440px] px-6 py-8 md:py-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-16 items-center">
          {/* Left */}
          <div className="order-2 lg:order-1">
            <p className="hidden md:block text-eyebrow-cap text-link-cool-3 mb-8 tracking-widest uppercase animate-fade-in-up">
              Inventory · Reservations · Multi-warehouse
            </p>
            <h1 className="text-display-xxl animate-fade-in-up delay-100">
              Hold the unit.
              <br />
              Pay later.
            </h1>
            <p className="text-body-lg text-link-cool-3 max-w-xl mt-6 md:mt-10 animate-fade-in-up delay-200">
              Race-free inventory holds across warehouses. Two carts can never
              claim the same unit.
            </p>
            <div className="flex items-center gap-4 mt-8 md:mt-12 animate-fade-in-up delay-300">
              <Link href="/products" className="pill pill-outline-dark">
                Browse products
              </Link>
            </div>
          </div>
          {/* Right — animated ASCII video */}
          <div className="order-1 lg:order-2 flex items-center justify-center lg:justify-end animate-fade-in delay-100">
            <VideoAscii
              src="/hero.mp4"
              resolution={130}
              backgroundColor="#000000"
              className="w-full max-w-[280px] sm:max-w-[380px] lg:max-w-[520px] aspect-square rounded-lg overflow-hidden"
            />
          </div>
        </div>
      </section>

      {/* ── Featured products ──────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-canvas-cream">
          <div className="mx-auto max-w-[1440px] px-6 py-16 md:py-24">
            <div className="flex items-end justify-between mb-10 animate-fade-in-up">
              <div>
                <p className="text-eyebrow-cap text-shade-50 mb-3 uppercase tracking-widest">
                  Featured
                </p>
                <h2 className="text-display-md">New arrivals</h2>
              </div>
              <Link href="/products" className="pill pill-primary hidden md:inline-flex">
                View all
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((product, i) => {
                const totalAvailable = product.stock.reduce(
                  (s, w) => s + w.available_units,
                  0,
                );
                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className={`group card flex flex-col overflow-hidden p-0 hover:-translate-y-1 hover:shadow-elevation-4 transition-[transform,box-shadow] duration-300 animate-fade-in-up delay-${(i + 1) * 100}`}
                  >
                    <div className="relative aspect-[4/3] w-full bg-shade-30 overflow-hidden rounded-lg">
                      {product.image_url && (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
                        />
                      )}
                    </div>
                    <div className="p-6 flex flex-col gap-1">
                      <h3 className="text-heading-lg line-clamp-1">{product.name}</h3>
                      <p className="text-heading-md text-shade-50 tabular-nums">
                        {formatPrice(product.price_cents)}
                      </p>
                      <p className="text-caption text-shade-50 mt-1">
                        {totalAvailable > 0
                          ? `${totalAvailable} available`
                          : "Out of stock"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-10 flex justify-center md:hidden">
              <Link href="/products" className="pill pill-primary">
                View all products
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Value prop band ────────────────────────────────────────── */}
      <section className="bg-canvas-night text-on-primary">
        <div className="mx-auto max-w-[1440px] px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: "Race-free holds", body: "Row-level locks in Postgres ensure two carts can never claim the same unit." },
            { label: "10-minute window", body: "Inventory is held while you complete payment, then confirmed or released." },
            { label: "Multi-warehouse", body: "Stock is tracked per warehouse. Reserve from the location closest to you." },
          ].map(({ label, body }, i) => (
            <div key={label} className={`flex flex-col gap-3 animate-fade-in-up delay-${(i + 1) * 100}`}>
              <h3 className="text-heading-md text-on-primary">{label}</h3>
              <p className="text-body-md text-link-cool-3">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
