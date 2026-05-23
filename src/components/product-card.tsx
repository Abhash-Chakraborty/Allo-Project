"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import clsx from "clsx";

import { newIdempotencyKey, formatPrice } from "@/lib/format";
import type { ProductDTO } from "@/lib/types";

interface ProductCardProps {
  product: ProductDTO;
}

interface ApiErrorBody {
  error: { code: string; message: string };
}

/**
 * Product card — a tile in the listing grid. Includes:
 *
 *   • product image, name, price, description
 *   • a per-warehouse availability table (total / reserved / available)
 *   • a "Reserve" button which opens a modal to choose warehouse + qty
 *   • inline error states for 409 / 410 / network
 *   • navigates to `/reservations/[id]` on success
 *
 * The whole card is a client component because the reserve button needs
 * state for the modal anyway, and the per-card local state stays
 * encapsulated. The page-level data fetch is server-side; this component
 * only receives props.
 */
export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Pick the first warehouse with available stock by default.
  const initialWarehouse = useMemo(() => {
    const withStock = product.stock.find((s) => s.available_units > 0);
    return withStock ?? product.stock[0];
  }, [product.stock]);

  const [warehouseId, setWarehouseId] = useState<string | null>(
    initialWarehouse?.warehouse.id ?? null,
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const formId = useId();

  const selectedStock = useMemo(
    () =>
      product.stock.find((s) => s.warehouse.id === warehouseId) ??
      initialWarehouse,
    [product.stock, warehouseId, initialWarehouse],
  );
  const totalAvailable = product.stock.reduce(
    (sum, s) => sum + s.available_units,
    0,
  );
  const allOutOfStock = totalAvailable <= 0;

  // Esc to close, focus trap-lite (focus inside on open).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Reset transient state when the user opens the modal — call this
  // directly rather than from an effect so we don't cascade renders.
  function openModal() {
    setError(null);
    setQuantity(1);
    setWarehouseId(initialWarehouse?.warehouse.id ?? null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!warehouseId || !selectedStock) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Bonus: idempotency. Generated per-attempt; if the user clicks
          // twice and the network is slow, the second request replays the
          // first's response instead of creating a duplicate hold.
          "Idempotency-Key": newIdempotencyKey(),
        },
        body: JSON.stringify({
          product_id: product.id,
          warehouse_id: warehouseId,
          quantity,
          ttl_seconds: Number(localStorage.getItem("allo_ttl_seconds")) || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | ApiErrorBody
          | null;
        throw new Error(
          body?.error?.message ??
            (res.status === 409
              ? "Not enough stock available."
              : `Reserve failed (${res.status}).`),
        );
      }
      const { reservation } = (await res.json()) as {
        reservation: { id: string };
      };
      // Force a revalidation so the listing reflects new reserved counts
      // when the user comes back. We also push to the checkout page.
      router.refresh();
      router.push(`/reservations/${reservation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="card flex flex-col p-0 h-[540px] overflow-hidden relative group cursor-pointer">
      {/* Full-card link — covers the whole card */}
      <Link
        href={`/products/${product.id}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${product.name}`}
        tabIndex={-1}
      />

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-shade-30 shrink-0">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1 px-6 pt-5">
        <h2 className="text-heading-lg line-clamp-1 relative z-10">
          {product.name}
        </h2>
        <span className="text-heading-md tabular-nums text-shade-50">
          {formatPrice(product.price_cents)}
        </span>
        <p className="text-body-md text-shade-60 line-clamp-2 mt-1">
          {product.description ?? "—"}
        </p>
      </div>

      <div className="mt-auto px-6 pt-4 pb-6 flex items-center justify-between gap-4 relative z-10">
        <span
          className={clsx(
            "tag",
            allOutOfStock
              ? "tag-danger"
              : totalAvailable <= 3
                ? "tag-warning"
                : "tag-mint",
          )}
        >
          {allOutOfStock
            ? "Out of stock"
            : totalAvailable <= 3
              ? `Only ${totalAvailable} left`
              : `${totalAvailable} available`}
        </span>
        <button
          type="button"
          className="pill pill-primary relative z-10"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openModal(); }}
          disabled={allOutOfStock}
          aria-disabled={allOutOfStock}
        >
          Reserve
        </button>
      </div>

      {open ? (
        <div
          className="modal-scrim"
          role="presentation"
          onMouseDown={(e) => {
            // Click outside the panel closes the modal.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal-panel flex flex-col gap-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${formId}-title`}
            ref={dialogRef}
            tabIndex={-1}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-eyebrow-cap text-shade-50">Reserve</p>
                <h3 id={`${formId}-title`} className="text-heading-xl mt-1">
                  {product.name}
                </h3>
              </div>
            </header>

            <form
              id={formId}
              className="flex flex-col gap-5"
              onSubmit={handleSubmit}
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${formId}-warehouse`}
                  className="text-caption text-shade-60"
                >
                  Warehouse
                </label>
                <select
                  id={`${formId}-warehouse`}
                  className="text-input"
                  value={warehouseId ?? ""}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  disabled={submitting}
                  required
                >
                  {product.stock.map((s) => (
                    <option
                      key={s.warehouse.id}
                      value={s.warehouse.id}
                      disabled={s.available_units <= 0}
                    >
                      {s.warehouse.name} — {s.available_units} available
                      {s.available_units <= 0 ? " (out)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${formId}-qty`}
                  className="text-caption text-shade-60"
                >
                  Quantity
                </label>
                <input
                  id={`${formId}-qty`}
                  type="number"
                  className="text-input tabular-nums"
                  min={1}
                  max={selectedStock?.available_units ?? 1}
                  step={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(1, Number.parseInt(e.target.value || "1", 10)),
                    )
                  }
                  disabled={submitting}
                  required
                />
                <p className="text-micro text-shade-50">
                  {selectedStock
                    ? `${selectedStock.available_units} available at ${selectedStock.warehouse.name}.`
                    : "Pick a warehouse to see availability."}
                </p>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-md border border-danger-fg/30 bg-danger-bg px-4 py-3"
                >
                  <p className="text-body-strong text-danger-fg">{error}</p>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="pill pill-outline-light"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pill pill-aloe"
                  disabled={
                    submitting ||
                    !selectedStock ||
                    quantity > (selectedStock?.available_units ?? 0)
                  }
                >
                  {submitting ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Reserving…
                    </>
                  ) : (
                    "Confirm hold"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </article>
  );
}


