import "server-only";

import { createHash } from "node:crypto";

import { ApiError } from "@/lib/api-error";
import { idempotencyKeySchema } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Idempotency middleware
 * ----------------------
 * Implements the "Idempotency-Key" pattern (a la Stripe) so a client
 * can retry a POST without doubling its side effect.
 *
 * Protocol
 * --------
 * On entry we attempt to *claim* the (key, endpoint) row by inserting
 * a placeholder with `status_code = 0`. If the insert succeeds we own
 * the in-flight request: we run the handler, then update the row with
 * the final response (status + body). If the insert conflicts we fall
 * into one of three branches:
 *
 *   1. Existing row's request_hash matches and status_code > 0:
 *      we replay the stored response. (The happy retry case.)
 *   2. Existing row's request_hash differs: 409 idempotency_conflict.
 *      The same key was used with a different request body — almost
 *      certainly a client bug.
 *   3. status_code is still 0: another request is currently in flight
 *      with the same key. We poll briefly, then give up with 425.
 *
 * Race-free claim
 * ---------------
 * The `INSERT ... ON CONFLICT DO NOTHING` claim is atomic at the
 * Postgres level: exactly one of N concurrent inserts of the same
 * (key, endpoint) succeeds.
 *
 * Cleanup
 * -------
 * Rows live forever in this implementation. In production you'd add a
 * cron that deletes rows older than 24h. Out of scope here — flagged
 * in the README.
 */

const POLL_INTERVAL_MS = 200;
const POLL_MAX_ATTEMPTS = 25; // ~5s upper bound

export interface IdempotentResult {
  status: number;
  body: unknown;
  /** True if this response was replayed from the idempotency cache. */
  replayed: boolean;
}

export type IdempotentHandler = () => Promise<{
  status: number;
  body: unknown;
}>;

function hashRequest(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input ?? null))
    .digest("hex");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `handler` under idempotency semantics.
 *
 * @param key      The raw `Idempotency-Key` header value (validated here).
 * @param endpoint A stable string identifying the route — eg `POST /api/reservations`.
 * @param requestPayload  The full request body. Used to compute a hash so
 *                  retries with a different body don't get the wrong reply.
 * @param handler  The actual operation to run. Must be deterministic-by-input.
 */
export async function withIdempotency(
  key: string,
  endpoint: string,
  requestPayload: unknown,
  handler: IdempotentHandler,
): Promise<IdempotentResult> {
  // 1. Validate the key shape — guards against weird abusive headers.
  const parsed = idempotencyKeySchema.safeParse(key);
  if (!parsed.success) {
    throw new ApiError({
      status: 400,
      code: "invalid_idempotency_key",
      message:
        "Idempotency-Key must be 8–120 chars, URL-safe (A-Z, a-z, 0-9, _-:.).",
    });
  }
  const safeKey = parsed.data;
  const requestHash = hashRequest(requestPayload);
  const supabase = getSupabaseAdmin();

  // 2. Try to claim the row.
  const { data: claim, error: claimErr } = await supabase
    .from("idempotency_keys")
    .insert({
      key: safeKey,
      endpoint,
      request_hash: requestHash,
      status_code: 0,
      response_body: { in_flight: true },
    })
    .select("key")
    .maybeSingle();

  // Postgres unique-violation code = '23505'. A null `claim` with no
  // error can also happen depending on PostgREST behavior — treat both
  // as "we did NOT claim".
  const claimed = !!claim && !claimErr;

  if (claimed) {
    // 3a. We own the request — execute the handler.
    let result: { status: number; body: unknown };
    try {
      result = await handler();
    } catch (handlerError) {
      // On failure, drop the claim row so the client can retry cleanly.
      await supabase
        .from("idempotency_keys")
        .delete()
        .eq("key", safeKey)
        .eq("endpoint", endpoint);
      throw handlerError;
    }

    // Persist the final response so subsequent retries can replay it.
    const responseBody =
      result.body === null || result.body === undefined ? {} : result.body;
    await supabase
      .from("idempotency_keys")
      .update({
        status_code: result.status,
        response_body: responseBody as never,
      })
      .eq("key", safeKey)
      .eq("endpoint", endpoint);

    return { ...result, replayed: false };
  }

  if (claimErr && claimErr.code !== "23505") {
    // Something other than a uniqueness conflict — surface it.
    throw new ApiError({
      status: 500,
      code: "idempotency_store_error",
      message: claimErr.message,
    });
  }

  // 3b. Someone else owns the row. Read it.
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const { data: existing, error: readErr } = await supabase
      .from("idempotency_keys")
      .select("status_code, response_body, request_hash")
      .eq("key", safeKey)
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (readErr || !existing) {
      // Should be impossible, but if so, briefly retry then bail.
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (existing.request_hash !== requestHash) {
      throw new ApiError({
        status: 409,
        code: "idempotency_conflict",
        message:
          "Idempotency-Key was reused with a different request payload.",
      });
    }

    if (existing.status_code > 0) {
      return {
        status: existing.status_code,
        body: existing.response_body,
        replayed: true,
      };
    }

    // Still in flight — wait and try again.
    await sleep(POLL_INTERVAL_MS);
  }

  throw new ApiError({
    status: 425,
    code: "idempotency_in_progress",
    message:
      "An identical request is still in progress. Try again in a moment.",
  });
}
