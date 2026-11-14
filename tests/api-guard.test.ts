import test from "node:test";
import assert from "node:assert/strict";

test("a configured shared limiter throttles triage across instances and never blocks on outage", async () => {
  const { sharedRateLimit } = await import("../lib/api-guard.ts");
  const post = () =>
    new Request("http://127.0.0.1/api/triage", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.7" },
    });
  const seen: string[] = [];
  const deny = { limit: async ({ key }: { key: string }) => (seen.push(key), { success: false }) };
  const allow = { limit: async () => ({ success: true }) };
  const broken = { limit: async () => { throw new Error("down"); } };
  const denied = await sharedRateLimit(post(), deny);
  assert.equal(denied?.status, 429);
  assert.equal(denied?.headers.get("retry-after"), "60");
  assert.deepEqual(seen, ["203.0.113.7"]);
  assert.equal(await sharedRateLimit(post(), allow), null);
  assert.equal(await sharedRateLimit(post(), broken), null);
  assert.equal(await sharedRateLimit(post(), undefined), null);
  assert.equal(await sharedRateLimit(new Request("http://127.0.0.1/api/health"), deny), null);
});
