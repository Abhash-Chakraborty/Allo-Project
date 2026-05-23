import { z } from "zod";

/**
 * Shared Zod schemas used by API routes for request validation and by
 * the UI for form-level validation. Re-using a single source of truth
 * avoids drift between client and server.
 */

export const uuidSchema = z.uuid();

export const reserveBodySchema = z.object({
  product_id: uuidSchema,
  warehouse_id: uuidSchema,
  quantity: z.number().int().positive().max(1000),
  customer_ref: z.string().trim().min(1).max(120).optional().nullable(),
  ttl_seconds: z.number().int().min(30).max(3600).optional(),
});

export type ReserveBody = z.infer<typeof reserveBodySchema>;

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[A-Za-z0-9_\-:.]+$/, "Idempotency-Key must be URL-safe");

export const reservationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "released",
  "expired",
]);
