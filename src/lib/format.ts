/** Locale-aware INR price formatter. */
export function formatPrice(cents: number): string {
  const rupees = cents / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** mm:ss countdown formatting. Caps at 99:59 to keep layout stable. */
export function formatCountdown(msRemaining: number): string {
  const safeMs = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.min(99, Math.floor(totalSeconds / 60));
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

// =============================================================================
// IST formatting
// =============================================================================
// Every human-facing timestamp in the app is rendered in IST (Asia/Kolkata),
// independent of the visitor's browser timezone. Postgres still stores UTC
// (`timestamptz`); these helpers shift only the display.
//
// Example outputs:
//   formatDateTimeIST("2026-05-25T06:13:38Z") → "25 May 2026, 11:43 am IST"
//   formatTimeIST("2026-05-25T06:13:38Z")     → "11:43 am IST"
// =============================================================================

const IST_TIME_ZONE = "Asia/Kolkata";

const istDateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const istTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const istDateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function toDate(input: Date | string | number): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "25 May 2026, 11:43 am IST" — full date + time, always IST. */
export function formatDateTimeIST(input: Date | string | number): string {
  const d = toDate(input);
  if (!d) return "—";
  return `${istDateTimeFmt.format(d)} IST`;
}

/** "11:43 am IST" — time only, always IST. */
export function formatTimeIST(input: Date | string | number): string {
  const d = toDate(input);
  if (!d) return "—";
  return `${istTimeFmt.format(d)} IST`;
}

/** "25 May 2026" — date only, always IST. */
export function formatDateIST(input: Date | string | number): string {
  const d = toDate(input);
  if (!d) return "—";
  return istDateFmt.format(d);
}

/** Calendar year as observed in IST (handles UTC→IST date rollover at 5:30 am). */
export function getYearIST(input: Date | string | number = new Date()): number {
  const d = toDate(input);
  if (!d) return new Date().getFullYear();
  // `en-CA` gives YYYY-MM-DD which is trivial to slice.
  const yyyy = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
  }).format(d);
  return Number.parseInt(yyyy, 10);
}

/**
 * URL-safe Idempotency-Key. Uses Web Crypto when available (browser and
 * Node 20+), falls back to Math.random for very old environments.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback — not RFC4122-compliant but URL-safe and unique enough
  // for retries.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
