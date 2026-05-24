// Product detail page
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductWithStock, listProducts } from "@/lib/data";
import { formatPrice } from "@/lib/format";

import { ReserveButton } from "@/components/reserve-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const product = await getProductWithStock(id);
  if (!product) return { title: "Product not found" };
  return { title: product.name };
}

function etaLabel(location: string | null): string {
  if (!location) return "3–5 business days";
  const loc = location.toLowerCase();
  if (loc.includes("bengaluru") || loc.includes("blr")) return "1–2 days";
  if (loc.includes("mumbai") || loc.includes("mum")) return "2–3 days";
  if (loc.includes("delhi") || loc.includes("del") || loc.includes("gurugram")) return "2–3 days";
  if (loc.includes("hyderabad") || loc.includes("hyd")) return "2–4 days";
  return "3–5 days";
}

export default async function ProductDetailPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;

  const [product, allProducts] = await Promise.all([
    getProductWithStock(id),
    listProducts().catch(() => []),
  ]);

  if (!product) notFound();

  const totalAvailable = product.stock.reduce((s, w) => s + w.available_units, 0);
  const allOutOfStock = totalAvailable === 0;

  // Similar: other products, up to 4
  const similar = allProducts.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-canvas-cream flex-1">
        <div className="mx-auto max-w-[1440px] px-6 py-10 md:py-14">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-caption text-shade-50 mb-8">
            <Link href="/" className="hover:text-ink transition-colors">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-ink transition-colors">Products</Link>
            <span>/</span>
            <span className="text-ink line-clamp-1">{product.name}</span>
          </nav>

          {/* ── Main layout: left col (image + info), right col (reserve) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 lg:gap-14">

            {/* LEFT: image then info stacked */}
            <div className="flex flex-col gap-8">

              {/* Image */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-shade-30">
                {product.image_url && (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover"
                    priority
                  />
                )}
              </div>

              {/* Info under image */}
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-eyebrow-cap text-shade-50 mb-2 uppercase tracking-widest">{product.sku}</p>
                  <h1 className="text-display-md">{product.name}</h1>
                  <p className="text-heading-xl text-shade-50 mt-3 tabular-nums">
                    {formatPrice(product.price_cents)}
                  </p>
                </div>

                {product.description && (
                  <p className="text-body-lg text-shade-60">{product.description}</p>
                )}

                <div className="flex flex-wrap gap-3">
                  <span className="tag tag-mint">Sold by Allo</span>
                  <span className={allOutOfStock ? "tag tag-danger" : "tag tag-mint"}>
                    {allOutOfStock ? "Out of stock" : `${totalAvailable} in stock`}
                  </span>
                </div>

                {/* Warehouse / ETA table */}
                <div className="rounded-lg border border-hairline-light overflow-hidden">
                  <div className="px-4 py-3 bg-canvas-light border-b border-hairline-light">
                    <p className="text-caption text-shade-60 uppercase tracking-widest">Availability by location</p>
                  </div>
                  <table className="w-full text-caption">
                    <thead className="bg-canvas-cream">
                      <tr className="text-left text-shade-60">
                        <th className="px-4 py-2.5 font-medium">Warehouse</th>
                        <th className="px-4 py-2.5 font-medium">Location</th>
                        <th className="px-4 py-2.5 font-medium">ETA</th>
                        <th className="px-4 py-2.5 font-medium text-right">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.stock.map((s) => (
                        <tr key={s.warehouse.id} className="border-t border-hairline-light">
                          <td className="px-4 py-3 text-body-strong">{s.warehouse.name}</td>
                          <td className="px-4 py-3 text-shade-60">{s.warehouse.location ?? s.warehouse.code}</td>
                          <td className="px-4 py-3 text-shade-60">{etaLabel(s.warehouse.location)}</td>
                          <td className={`px-4 py-3 text-right tabular-nums font-medium ${s.available_units === 0 ? "text-danger-fg" : "text-ink"}`}>
                            {s.available_units}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Product details */}
                <div className="rounded-lg border border-hairline-light overflow-hidden">
                  <div className="px-4 py-3 bg-canvas-light border-b border-hairline-light">
                    <p className="text-caption text-shade-60 uppercase tracking-widest">Product details</p>
                  </div>
                  <dl className="divide-y divide-hairline-light">
                    {[
                      { label: "SKU", value: product.sku },
                      { label: "Seller", value: "Allo Direct" },
                      { label: "Fulfilment", value: "Shipped from nearest warehouse" },
                      { label: "Returns", value: "30-day returns accepted" },
                      { label: "Hold window", value: "10 minutes after reservation" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                        <dt className="text-caption text-shade-50 shrink-0">{label}</dt>
                        <dd className="text-caption text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>

            {/* RIGHT: sticky reserve panel */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <div className="card flex flex-col gap-5 p-6 min-h-[600px]">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-shade-30">
                {product.image_url && (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover"
                    priority
                  />
                )}
              </div>
                <div>
                  <p className="text-eyebrow-cap text-shade-50 mb-2 uppercase tracking-widest">{product.sku}</p>
                  <h2 className="text-heading-lg mb-1">{product.name}</h2>
                  {product.description && (
                  <p className="text-body-sm text-shade-50 mb-3">{product.description}</p>
                  )}
                  <p className="text-heading-md text-shade-50 mt-1 tabular-nums">
                    {formatPrice(product.price_cents)}
                  </p>
                </div>
                <div className="flex-col absolute bottom-10">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="tag tag-mint">Sold by Allo</span>
                    <span className={allOutOfStock ? "tag tag-danger" : "tag tag-mint"}>
                      {allOutOfStock ? "Out of stock" : `${totalAvailable} available`}
                    </span>
                  </div>
                  <ReserveButton product={product} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Similar products ──────────────────────────────────── */}
          {similar.length > 0 && (
            <section className="mt-20">
              <div className="flex items-end justify-between mb-8">
                <h2 className="text-display-md">Similar products</h2>
                <Link href="/products" className="pill pill-primary hidden md:inline-flex">
                  View all
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {similar.map((p) => {
                  const avail = p.stock.reduce((s, w) => s + w.available_units, 0);
                  return (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="group card flex flex-col overflow-hidden p-0 hover:shadow-elevation-3 transition-shadow"
                    >
                      <div className="relative aspect-[4/3] w-full bg-shade-30 overflow-hidden">
                        {p.image_url && (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                          />
                        )}
                      </div>
                      <div className="p-5 flex flex-col gap-1">
                        <h3 className="text-heading-md line-clamp-1">{p.name}</h3>
                        <p className="text-body-md text-shade-50 tabular-nums">{formatPrice(p.price_cents)}</p>
                        <p className="text-caption text-shade-50 mt-1">
                          {avail > 0 ? `${avail} available` : "Out of stock"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-8 flex justify-center md:hidden">
                <Link href="/products" className="pill pill-primary">View all products</Link>
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
