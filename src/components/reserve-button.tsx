// Reserve button — opens a centered modal with backdrop blur
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { newIdempotencyKey } from "@/lib/format";
import type { ProductDTO } from "@/lib/types";

interface ApiErrorBody { error: { code: string; message: string } }

export function ReserveButton({ product }: { product: ProductDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const formId = useId();

  const initialWarehouse = useMemo(() => {
    return product.stock.find((s) => s.available_units > 0) ?? product.stock[0];
  }, [product.stock]);

  const [warehouseId, setWarehouseId] = useState<string | null>(initialWarehouse?.warehouse.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = useMemo(
    () => product.stock.find((s) => s.warehouse.id === warehouseId) ?? initialWarehouse,
    [product.stock, warehouseId, initialWarehouse],
  );
  const totalAvailable = product.stock.reduce((s, w) => s + w.available_units, 0);
  const allOutOfStock = totalAvailable <= 0;

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the panel for screen readers.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function openCard() {
    setError(null); setQuantity(1);
    setWarehouseId(initialWarehouse?.warehouse.id ?? null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!warehouseId || !selectedStock) return;
    setError(null); setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": newIdempotencyKey() },
        body: JSON.stringify({ product_id: product.id, warehouse_id: warehouseId, quantity }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        throw new Error(body?.error?.message ?? (res.status === 409 ? "Not enough stock." : `Failed (${res.status}).`));
      }
      const { reservation } = await res.json() as { reservation: { id: string } };
      router.refresh();
      router.push(`/reservations/${reservation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Trigger button — stays in place in the DOM */}
      <button
        type="button"
        className="pill pill-primary w-full"
        onClick={openCard}
        disabled={allOutOfStock}
      >
        {allOutOfStock ? "Out of stock" : "Reserve"}
      </button>

      {/* Centered modal with blurred backdrop — both desktop and mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => {
              // Close only when click starts on the scrim itself, not the panel.
              if (e.target === e.currentTarget) setOpen(false);
            }}
            aria-hidden={false}
          >
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${formId}-title`}
              tabIndex={-1}
              className="w-full max-w-[420px] rounded-2xl border border-hairline-light bg-canvas-light shadow-elevation-4 overflow-hidden max-h-[90dvh] flex flex-col outline-none"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Card header */}
              <div className="px-5 pt-5 pb-4 border-b border-hairline-light flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-eyebrow-cap text-shade-50 uppercase tracking-widest">Reserve</p>
                  <h3 id={`${formId}-title`} className="text-heading-lg mt-1 line-clamp-2">{product.name}</h3>
                </div>
                <button
                  type="button"
                  className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-shade-60 hover:bg-canvas-cream hover:text-ink transition-colors"
                  aria-label="Close reservation form"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Form (scrollable on small screens) */}
              <form id={formId} className="flex flex-col gap-4 px-5 py-4 overflow-y-auto" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-wh`} className="text-caption text-shade-60">Warehouse</label>
                  <select
                    id={`${formId}-wh`}
                    className="text-input"
                    value={warehouseId ?? ""}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    disabled={submitting}
                    required
                  >
                    {product.stock.map((s) => (
                      <option key={s.warehouse.id} value={s.warehouse.id} disabled={s.available_units <= 0}>
                        {s.warehouse.name} — {s.available_units} available{s.available_units <= 0 ? " (out)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-qty`} className="text-caption text-shade-60">Quantity</label>
                  <input
                    id={`${formId}-qty`}
                    type="number"
                    inputMode="numeric"
                    className="text-input tabular-nums"
                    min={1}
                    max={selectedStock?.available_units ?? 1}
                    step={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    disabled={submitting}
                    required
                  />
                  <p className="text-micro text-shade-50">
                    {selectedStock ? `${selectedStock.available_units} available at ${selectedStock.warehouse.name}.` : "Pick a warehouse."}
                  </p>
                </div>

                {error && (
                  <div role="alert" className="rounded-md border border-danger-fg/30 bg-danger-bg px-4 py-3">
                    <p className="text-body-strong text-danger-fg">{error}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="pill pill-outline-light flex-1"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="pill pill-aloe flex-1"
                    disabled={submitting || !selectedStock || quantity > (selectedStock?.available_units ?? 0)}
                  >
                    {submitting ? (
                      <><span className="spinner" aria-hidden="true" />Reserving…</>
                    ) : "Confirm hold"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
