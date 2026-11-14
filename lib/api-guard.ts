import { apiError } from "./http.ts";
import {
  checkRateLimit,
  clientKey,
  secretsMatch,
  type RateLimitResult,
} from "./rate-limit.ts";
export function guardTriageApi(
  request: Request,
  options: { apiKey?: string; limit?: (key: string) => RateLimitResult } = {},
): Response | null {
  if (new URL(request.url).pathname.replace(/\/+$/, "") !== "/api/triage")
    return null;
  const id = crypto.randomUUID();
  if (request.method !== "POST")
    return apiError("method_not_allowed", "Use POST for triage.", 405, id, {
      Allow: "POST",
    });
  if (
    options.apiKey &&
    !secretsMatch(request.headers.get("x-api-key"), options.apiKey)
  )
    return apiError(
      "unauthorized",
      "This service requires an API key.",
      401,
      id,
    );
  const limit = (options.limit ?? checkRateLimit)(clientKey(request));
  if (!limit.ok)
    return apiError(
      "rate_limited",
      "Too many requests. Please wait and retry.",
      429,
      id,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  return null;
}

/** A shared quota service, such as a Cloudflare Rate Limiting binding. */
export type SharedLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

/**
 * Enforce a quota shared across Worker instances when one is configured.
 * Returns a 429 response, or null to continue. A limiter outage never blocks
 * triage: the per-instance limiter in guardTriageApi still applies.
 */
export async function sharedRateLimit(
  request: Request,
  limiter: SharedLimiter | undefined,
): Promise<Response | null> {
  if (!limiter) return null;
  if (new URL(request.url).pathname.replace(/\/+$/, "") !== "/api/triage")
    return null;
  if (request.method !== "POST") return null;
  try {
    const { success } = await limiter.limit({ key: clientKey(request) });
    if (success) return null;
  } catch {
    return null;
  }
  return apiError(
    "rate_limited",
    "Too many requests. Please wait and retry.",
    429,
    crypto.randomUUID(),
    { "Retry-After": "60" },
  );
}
