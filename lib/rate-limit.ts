/**
 * Per-isolate fixed-window rate limiter.
 *
 * Workers isolates are short lived and distributed, so this is a best-effort
 * guard that removes the "unlimited calls" failure mode rather than a precise
 * global quota. A durable, per-tenant limit belongs in the edge rule set.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000 && buckets.size < MAX_BUCKETS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets)
    if (bucket.resetAt <= now) buckets.delete(key);
  // Hard bound so a flood of distinct keys cannot exhaust the isolate.
  if (buckets.size > MAX_BUCKETS) {
    const entries = [...buckets.entries()].sort(
      (a, b) => a[1].resetAt - b[1].resetAt,
    );
    for (const [key] of entries.slice(0, entries.length - MAX_BUCKETS))
      buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit)
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Best-effort client identity for the rate limiter. */
export function clientKey(request: Request): string {
  const connecting = request.headers.get("CF-Connecting-IP");
  if (connecting) return connecting;
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "anonymous";
}

/** Constant-time comparison so a key cannot be recovered by timing the reply. */
export function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided || provided.length === 0) return false;
  let mismatch = provided.length === expected.length ? 0 : 1;
  const length = Math.max(provided.length, expected.length);
  for (let i = 0; i < length; i++)
    mismatch |= provided.charCodeAt(i % provided.length) ^ expected.charCodeAt(i % expected.length);
  return mismatch === 0;
}
