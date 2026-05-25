"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import clsx from "clsx";

import { formatCountdown, formatDateTimeIST, formatPrice, formatTimeIST, newIdempotencyKey } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type {
  ProductDTO,
  ReservationDTO,
  ReservationStatus,
  WarehouseDTO,
} from "@/lib/types";

interface ReservationViewProps {
  initialReservation: ReservationDTO;
  product: Pick<
    ProductDTO,
    "id" | "sku" | "name" | "description" | "price_cents" | "image_url"
  >;
  warehouse: WarehouseDTO;
}

interface ApiErrorBody {
  error: { code: string; message: string };
}

const POLL_INTERVAL_MS = 5_000;

export function ReservationView({
  initialReservation,
  product,
  warehouse,
}: ReservationViewProps) {
  const router = useRouter();
  const [reservation, setReservation] =
    useState<ReservationDTO>(initialReservation);
  const [now, setNow] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<
    "confirm" | "release" | null
  >(null);
  const expiresAtMs = useMemo(
    () => new Date(reservation.expires_at).getTime(),
    [reservation.expires_at],
  );
  const msRemaining = Math.max(0, expiresAtMs - now);
  const isPending = reservation.status === "pending";

  // ---------------------------------------------------------------
  // 1. Refresh helper — re-pull the reservation from the API.
  // ---------------------------------------------------------------
  const reservationId = reservation.id;
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { reservation: ReservationDTO };
      setReservation(body.reservation);
    } catch {
      // Network blips are non-fatal; the next poll will retry.
    }
  }, [reservationId]);

  // ---------------------------------------------------------------
  // 2. Countdown ticker — every 250ms while pending.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!isPending) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [isPending]);

  // ---------------------------------------------------------------
  // 3. When the local clock crosses expires_at, trigger a reload so
  //    the server runs lazy expiry and the UI flips to `expired`.
  // ---------------------------------------------------------------
  const triggeredExpiry = useRef(false);
  useEffect(() => {
    if (!isPending) {
      triggeredExpiry.current = false;
      return;
    }
    if (msRemaining === 0 && !triggeredExpiry.current) {
      triggeredExpiry.current = true;
      void reload();
    }
  }, [msRemaining, isPending, reload]);

  // ---------------------------------------------------------------
  // 4. Polling fallback — covers cases where realtime isn't connected
  //    (e.g. anon role lacks the publication, env missing).
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!isPending) return;
    const id = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPending, reload]);

  // ---------------------------------------------------------------
  // 5. Realtime subscription — flips state without waiting for the poll.
  // ---------------------------------------------------------------
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const channel = supabase
      .channel(`reservation-${reservationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
          filter: `id=eq.${reservationId}`,
        },
        (payload) => {
          const row = payload.new as ReservationDTO;
          if (row && row.id === reservationId) setReservation(row);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reservationId]);

  // ---------------------------------------------------------------
  // 6. Action handlers.
  // ---------------------------------------------------------------
  async function postAction(
    kind: "confirm" | "release",
    options: { idempotent?: boolean } = {},
  ) {
    setError(null);
    setActionInFlight(kind);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (options.idempotent) {
        headers["Idempotency-Key"] = newIdempotencyKey();
      }
      const res = await fetch(`/api/reservations/${reservationId}/${kind}`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | ApiErrorBody
          | null;
        const code = body?.error?.code;
        // 410 still surfaces a server-side row update, so reload anyway.
        if (code === "reservation_expired" || res.status === 410) {
          await reload();
        }
        throw new Error(
          body?.error?.message ?? `${kind} failed (${res.status}).`,
        );
      }
      const body = (await res.json()) as { reservation: ReservationDTO };
      setReservation(body.reservation);
      // Also refresh the listing so available stock is current next visit.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${kind} failed.`);
    } finally {
      setActionInFlight(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(360px,420px)] gap-8 lg:gap-12">
      {/* -------- Left column: product summary ------------------------- */}
      <section className="card flex flex-col gap-6 p-6 md:p-8">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-shade-30">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
              priority
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-eyebrow-cap text-shade-50">SKU · {product.sku}</p>
          <h1 className="text-display-md">{product.name}</h1>
          <p className="text-body-md text-shade-60 max-w-prose">
            {product.description}
          </p>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-hairline-light pt-6">
          <div>
            <p className="text-eyebrow-cap text-shade-50">Hold from</p>
            <p className="text-body-strong mt-1">{warehouse.name}</p>
            <p className="text-caption text-shade-60">
              {warehouse.location ?? warehouse.code}
            </p>
          </div>
          <div className="text-right">
            <p className="text-eyebrow-cap text-shade-50">Quantity</p>
            <p className="text-heading-md mt-1 tabular-nums">
              × {reservation.quantity}
            </p>
          </div>
          <div className="text-right">
            <p className="text-eyebrow-cap text-shade-50">Subtotal</p>
            <p className="text-heading-xl mt-1 tabular-nums">
              {formatPrice(product.price_cents * reservation.quantity)}
            </p>
          </div>
        </div>
      </section>

      {/* -------- Right column: status + actions ----------------------- */}
      <aside className="flex flex-col gap-4">
        <StatusBanner status={reservation.status} />

        {isPending ? (
          <CountdownPanel
            msRemaining={msRemaining}
            expiresAt={reservation.expires_at}
          />
        ) : (
          <TerminalPanel reservation={reservation} />
        )}

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-danger-fg/30 bg-danger-bg px-4 py-3"
          >
            <p className="text-body-strong text-danger-fg">{error}</p>
          </div>
        ) : null}

        {isPending ? (
          <div className="card flex flex-col gap-3 p-6">
            <h2 className="text-heading-md">Complete your reservation</h2>
            <p className="text-caption text-shade-60">
              Confirm to charge & decrement stock, or cancel to release the
              units back to the warehouse.
            </p>
            <button
              type="button"
              className="pill pill-aloe"
              onClick={() => postAction("confirm", { idempotent: true })}
              disabled={actionInFlight !== null}
            >
              {actionInFlight === "confirm" ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Confirming…
                </>
              ) : (
                "Confirm purchase"
              )}
            </button>
            <button
              type="button"
              className="pill pill-outline-light"
              onClick={() => postAction("release")}
              disabled={actionInFlight !== null}
            >
              {actionInFlight === "release" ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Cancelling…
                </>
              ) : (
                "Cancel hold"
              )}
            </button>
          </div>
        ) : (
          <Link href="/" className="pill pill-primary self-start">
            Back to inventory
          </Link>
        )}

        <details className="text-caption text-shade-60">
          <summary className="cursor-pointer text-body-strong">
            Reservation metadata
          </summary>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mt-3 font-mono text-micro">
            <dt>id</dt>
            <dd className="break-all">{reservation.id}</dd>
            <dt>created</dt>
            <dd>{formatDateTimeIST(reservation.created_at)}</dd>
            <dt>expires</dt>
            <dd>{formatDateTimeIST(reservation.expires_at)}</dd>
            {reservation.confirmed_at ? (
              <>
                <dt>confirmed</dt>
                <dd>{formatDateTimeIST(reservation.confirmed_at)}</dd>
              </>
            ) : null}
            {reservation.released_at ? (
              <>
                <dt>released</dt>
                <dd>{formatDateTimeIST(reservation.released_at)}</dd>
              </>
            ) : null}
            {reservation.expired_at ? (
              <>
                <dt>expired</dt>
                <dd>{formatDateTimeIST(reservation.expired_at)}</dd>
              </>
            ) : null}
          </dl>
        </details>
      </aside>
    </div>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

function StatusBanner({ status }: { status: ReservationStatus }) {
  const map: Record<
    ReservationStatus,
    { label: string; className: string; description: string }
  > = {
    pending: {
      label: "Pending",
      className: "tag-warning",
      description: "Units held — confirm before the timer runs out.",
    },
    confirmed: {
      label: "Confirmed",
      className: "tag-success",
      description: "Reservation confirmed. Stock has been decremented.",
    },
    released: {
      label: "Cancelled",
      className: "tag-shade",
      description: "Reservation cancelled. Units returned to the warehouse.",
    },
    expired: {
      label: "Expired",
      className: "tag-danger",
      description:
        "The hold expired. Units have been released back to inventory.",
    },
  };
  const info = map[status];
  return (
    <div className="card p-6 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={clsx("tag", info.className)}>{info.label}</span>
        <span className="text-eyebrow-cap text-shade-50">Reservation</span>
      </div>
      <p className="text-body-md text-ink mt-1">{info.description}</p>
    </div>
  );
}

function CountdownPanel({
  msRemaining,
  expiresAt,
}: {
  msRemaining: number;
  expiresAt: string;
}) {
  const display = formatCountdown(msRemaining);
  const isCritical = msRemaining <= 30_000;
  return (
    <div
      className={clsx(
        "card p-6 flex flex-col gap-2",
        isCritical ? "ring-2 ring-danger-fg/30" : null,
      )}
    >
      <p className="text-eyebrow-cap text-shade-50">Time remaining</p>
      <p
        className={clsx(
          "text-display-md tabular-nums",
          isCritical ? "text-danger-fg" : "text-ink",
        )}
        aria-live="polite"
      >
        {display}
      </p>
      <p className="text-caption text-shade-60">
        Expires at {formatTimeIST(expiresAt)}
      </p>
    </div>
  );
}

function TerminalPanel({ reservation }: { reservation: ReservationDTO }) {
  const date =
    reservation.confirmed_at ??
    reservation.released_at ??
    reservation.expired_at;
  return (
    <div className="card p-6 flex flex-col gap-2">
      <p className="text-eyebrow-cap text-shade-50">Final status</p>
      <p className="text-display-md">
        {reservation.status[0].toUpperCase() + reservation.status.slice(1)}
      </p>
      {date ? (
        <p className="text-caption text-shade-60">
          {formatDateTimeIST(date)}
        </p>
      ) : null}
    </div>
  );
}
