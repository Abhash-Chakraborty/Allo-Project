import "server-only";

/**
 * Centralized server-side runtime config. Every reader should go
 * through here so we can validate / default in one place.
 */

export const reservationTtlSeconds = (() => {
  const raw = process.env.RESERVATION_TTL_SECONDS;
  if (!raw) return 600; // 10 min default
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `Invalid RESERVATION_TTL_SECONDS=${raw}; must be a positive integer.`,
    );
  }
  return n;
})();

export const cronSecret = process.env.CRON_SECRET ?? "";
