import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * A small, framework-agnostic error type used throughout the API
 * surface. We match on `code` (a stable string) rather than HTTP
 * status when we need to react in the UI.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(opts.message);
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

/** Shape of an error body returned by every API route. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/**
 * Translate a Postgres / PostgREST error (as returned through Supabase
 * `.rpc(...)` calls) into a typed ApiError. The mapping is keyed on
 * the textual token raised by our stored functions; see
 * supabase/migrations/0002_functions.sql.
 */
export function apiErrorFromPgError(err: {
  message?: string | null;
  code?: string | null;
  details?: string | null;
}): ApiError {
  const message = err.message ?? "Unknown database error";

  // Tokens come first in the message thanks to `raise exception 'TOKEN ...'`.
  if (message.startsWith("INSUFFICIENT_STOCK")) {
    return new ApiError({
      status: 409,
      code: "insufficient_stock",
      message: "Not enough stock available for the requested quantity.",
      details: message,
    });
  }
  if (message.startsWith("RESERVATION_EXPIRED")) {
    return new ApiError({
      status: 410,
      code: "reservation_expired",
      message: "This reservation has expired.",
    });
  }
  if (message.startsWith("RESERVATION_RELEASED")) {
    return new ApiError({
      status: 409,
      code: "reservation_released",
      message: "This reservation has already been released.",
    });
  }
  if (message.startsWith("RESERVATION_ALREADY_CONFIRMED")) {
    return new ApiError({
      status: 409,
      code: "reservation_already_confirmed",
      message: "This reservation has already been confirmed.",
    });
  }
  if (
    message.startsWith("RESERVATION_NOT_FOUND") ||
    message.startsWith("INVENTORY_NOT_FOUND")
  ) {
    return new ApiError({
      status: 404,
      code: "not_found",
      message: "Resource not found.",
    });
  }
  if (
    message.startsWith("INVALID_QUANTITY") ||
    message.startsWith("INVALID_TTL")
  ) {
    return new ApiError({
      status: 400,
      code: "invalid_request",
      message,
    });
  }

  // Fallback: server-side error.
  return new ApiError({
    status: 500,
    code: "internal_error",
    message: "Database error.",
    details: process.env.NODE_ENV === "production" ? undefined : message,
  });
}

/** Convert any thrown thing into a JSON NextResponse. */
export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ApiError) {
    return NextResponse.json<ApiErrorBody>(
      {
        error: { code: err.code, message: err.message, details: err.details },
      },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: err.issues,
        },
      },
      { status: 400 },
    );
  }
  // Last resort — never leak details in prod.
  console.error("[API] unhandled error", err);
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "internal_error", message: "Internal server error." } },
    { status: 500 },
  );
}
