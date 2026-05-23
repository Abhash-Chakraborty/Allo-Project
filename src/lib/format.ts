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
