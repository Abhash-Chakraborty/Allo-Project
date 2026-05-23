"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { newIdempotencyKey } from "@/lib/format";
import type { ProductDTO } from "@/lib/types";

interface ApiErrorBody { error: { code: string; message: string } }

export function ReserveButton({ product }: { product: ProductDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openModal() {
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
      <button
        type="button"
        className="pill pill-primary w-full"
        onClick={openModal}
        disabled={allOutOfStock}
      >
        {allOutOfStock ? "Out of stock" : "Reserve"}
      </button>

      {open && (
        <div
          className="modal-scrim"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
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
                <h3 id={`${formId}-title`} className="text-heading-xl mt-1">{product.name}</h3>
              </div>
            </header>

            <form id={formId} className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <label htmlFor={`${formId}-wh`} className="text-caption text-shade-60">Warehouse</label>
                <select id={`${formId}-wh`} className="text-input" value={warehouseId ?? ""} onChange={(e) => setWarehouseId(e.target.value)} disabled={submitting} required>
                  {product.stock.map((s) => (
                    <option key={s.warehouse.id} value={s.warehouse.id} disabled={s.available_units <= 0}>
                      {s.warehouse.name} — {s.available_units} available{s.available_units <= 0 ? " (out)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor={`${formId}-qty`} className="text-caption text-shade-60">Quantity</label>
                <input id={`${formId}-qty`} type="number" className="text-input tabular-nums" min={1} max={selectedStock?.available_units ?? 1} step={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))} disabled={submitting} required />
                <p className="text-micro text-shade-50">{selectedStock ? `${selectedStock.available_units} available at ${selectedStock.warehouse.name}.` : "Pick a warehouse."}</p>
              </div>

              {error && (
                <div role="alert" className="rounded-md border border-danger-fg/30 bg-danger-bg px-4 py-3">
                  <p className="text-body-strong text-danger-fg">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button type="button" className="pill pill-outline-light" onClick={() => setOpen(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="pill pill-aloe" disabled={submitting || !selectedStock || quantity > (selectedStock?.available_units ?? 0)}>
                  {submitting ? <><span className="spinner" aria-hidden="true" />Reserving…</> : "Confirm hold"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
