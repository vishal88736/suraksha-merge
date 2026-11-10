import test from "node:test";
import assert from "node:assert/strict";
import { requestTriage, TriageClientError } from "../lib/triage-client.ts";
import { createTriageHandler } from "../lib/triage-api.ts";
const input = { message: "Bhai unauthorised Rs.500 debit UTR 431289014421" };
test("client and handler agree on the full result contract", async () => {
  const server = createTriageHandler();
  const response = await requestTriage(input, {
    fetch: async (_url, init) =>
      server(new Request("https://test.local/api/triage", init)),
  });
  assert.equal(response.payload.utr_number, "431289014421");
  assert.equal(response.audit.external_actions_taken, false);
});
test("malformed and incomplete service responses cannot replace a valid assessment", async () => {
  for (const response of [
    Response.json({ payload: {} }),
    new Response("<html>unavailable</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    new Response("{bad", { headers: { "Content-Type": "application/json" } }),
  ])
    await assert.rejects(
      requestTriage(input, { fetch: async () => response }),
      (error) =>
        error instanceof TriageClientError && error.code === "invalid_response",
    );
});
test("rate limits are retryable, structured and bounded", async () => {
  await assert.rejects(
    requestTriage(input, {
      fetch: async () =>
        Response.json(
          { error: { code: "rate_limited" } },
          {
            status: 429,
            headers: { "Retry-After": "60", "x-request-id": "test-id" },
          },
        ),
    }),
    (error) =>
      error instanceof TriageClientError &&
      error.code === "rate_limited" &&
      error.retryAfterSeconds === 60 &&
      error.requestId === "test-id",
  );
});
test("a hanging network request times out without discarding its input", async () => {
  const network: typeof fetch = async (_url, options) =>
    new Promise((_resolve, reject) =>
      options?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      ),
    );
  await assert.rejects(
    requestTriage(input, { fetch: network, timeoutMs: 15 }),
    (error) => error instanceof TriageClientError && error.code === "timeout",
  );
  assert.ok(input.message.length > 0);
});
test("caller cancellation stays distinct from a timeout", async () => {
  const controller = new AbortController();
  controller.abort();
  const network: typeof fetch = async () => {
    throw new DOMException("Aborted", "AbortError");
  };
  await assert.rejects(
    requestTriage(input, { signal: controller.signal, fetch: network }),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
});
