// Reservation checkout page
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api-error";
import {
  getProductById,
  getReservation,
  getWarehouseById,
} from "@/lib/data";

import { ReservationView } from "@/components/reservation-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<"/reservations/[id]">,
) {
  const { id } = await props.params;
  return { title: `Reservation ${id.slice(0, 8)}…` };
}

export default async function ReservationPage(
  props: PageProps<"/reservations/[id]">,
) {
  const { id } = await props.params;

  let reservation;
  try {
    reservation = await getReservation(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [product, warehouse] = await Promise.all([
    getProductById(reservation.product_id),
    getWarehouseById(reservation.warehouse_id),
  ]);

  if (!product || !warehouse) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-canvas-cream flex-1">
        <div className="mx-auto max-w-[1440px] px-6 py-12 md:py-16">
          <nav className="text-caption text-shade-60 mb-6 flex items-center gap-2">
            <Link href="/" className="hover:underline">
              Inventory
            </Link>
            <span aria-hidden>›</span>
            <span className="text-ink">Reservation</span>
          </nav>
          <ReservationView
            initialReservation={reservation}
            product={{
              id: product.id,
              sku: product.sku,
              name: product.name,
              description: product.description,
              price_cents: product.price_cents,
              image_url: product.image_url,
            }}
            warehouse={{
              id: warehouse.id,
              code: warehouse.code,
              name: warehouse.name,
              location: warehouse.location,
            }}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
