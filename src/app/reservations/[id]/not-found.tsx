import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ReservationNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="bg-canvas-cream flex-1">
        <div className="mx-auto max-w-[1440px] px-6 py-24 md:py-32 max-w-prose">
          <p className="text-eyebrow-cap text-shade-50 mb-4">404 · Reservation</p>
          <h1 className="text-display-md mb-4">Reservation not found</h1>
          <p className="text-body-lg text-shade-60 mb-8">
            The reservation you’re looking for doesn’t exist, or it may have
            been deleted from the database.
          </p>
          <Link href="/" className="pill pill-primary">
            Back to inventory
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
