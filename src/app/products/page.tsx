import Link from "next/link";

import { listProducts } from "@/lib/data";
import { ProductGrid } from "@/components/product-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Products" };

export default async function ProductsPage() {
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let loadError: string | null = null;

  try {
    products = await listProducts();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load products.";
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-canvas-cream flex-1">
        <div className="mx-auto max-w-[1440px] px-6 py-10 md:py-14">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-caption text-shade-50 mb-8">
            <Link href="/" className="hover:text-ink transition-colors">Home</Link>
            <span>/</span>
            <span className="text-ink">Products</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <h1 className="text-display-md">Products</h1>
            <p className="text-caption text-shade-50 max-w-sm">
              {products.length} items · click a card to quick-reserve
            </p>
          </div>

          {loadError ? (
            <div role="alert" className="rounded-lg border border-hairline-light bg-canvas-light p-8 max-w-2xl">
              <p className="text-body-strong">Couldn't reach inventory</p>
              <p className="text-body-md text-shade-60 mt-2">{loadError}</p>
            </div>
          ) : products.length === 0 ? (
            <p className="text-body-md text-shade-60">No products yet.</p>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
