import { createHash, timingSafeEqual } from "node:crypto";
/** A bounded, best-effort per-isolate limiter; no global-quota claim is made. */
export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};
export function createRateLimiter(
  options: {
    limit?: number;
    windowMs?: number;
    maxBuckets?: number;
    now?: () => number;
  } = {},
) {
  const limit = options.limit ?? 30,
    windowMs = options.windowMs ?? 60_000,
    maxBuckets = options.maxBuckets ?? 10_000;
  if (
    ![limit, windowMs, maxBuckets].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    )
  )
    throw new RangeError("Invalid rate-limit configuration");
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = 0;
  return (key: string): RateLimitResult => {
    const now = (options.now ?? Date.now)();
    if (now >= nextSweep) {
      for (const [id, bucket] of buckets)
        if (bucket.resetAt <= now) buckets.delete(id);
      nextSweep = now + Math.min(windowMs, 10_000);
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && buckets.size >= maxBuckets)
        return {
          ok: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((nextSweep - now) / 1000)),
        };
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }
    if (bucket.count >= limit)
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1000),
        ),
      };
    bucket.count++;
    return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
  };
}
const limiter = createRateLimiter();
export const checkRateLimit = (key: string) => limiter(key);
/** CF supplies this header at the trusted edge. Untrusted X-Forwarded-For is ignored. */
export function clientKey(request: Request): string {
  const connecting = request.headers.get("CF-Connecting-IP");
  return connecting &&
    connecting.length <= 64 &&
    /^[\da-fA-F:.]+$/.test(connecting)
    ? connecting
    : "anonymous";
}
/** Fixed-size digest comparison; never publish, log or persist credentials. */
export function secretsMatch(
  provided: string | null,
  expected: string,
): boolean {
  if (!provided || !expected || provided.length > 512 || expected.length > 512)
    return false;
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
