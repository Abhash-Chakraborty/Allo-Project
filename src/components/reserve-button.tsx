// Reserve button with expandable card animation
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
  const cardRef = useRef<HTMLDivElement | null>(null);
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

  // Close on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
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
    <div className="relative w-full">
      {/* Trigger button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="trigger"
            type="button"
            className="pill pill-primary w-full"
            onClick={openCard}
            disabled={allOutOfStock}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {allOutOfStock ? "Out of stock" : "Reserve"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expandable card — expands in place, no overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="card"
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${formId}-title`}
            tabIndex={-1}
            className="w-full rounded-2xl border border-hairline-light bg-canvas-light shadow-elevation-4 overflow-hidden"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            {/* Card header */}
            <div className="px-5 pt-5 pb-4 border-b border-hairline-light">
              <p className="text-eyebrow-cap text-shade-50 uppercase tracking-widest">Reserve</p>
              <h3 id={`${formId}-title`} className="text-heading-lg mt-1 line-clamp-1">{product.name}</h3>
            </div>

            {/* Form */}
            <form id={formId} className="flex flex-col gap-4 px-5 py-4" onSubmit={handleSubmit}>
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
        )}
      </AnimatePresence>
    </div>
  );
}
