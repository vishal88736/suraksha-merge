import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/triage/route.ts";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://suraksha.test/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

test("a valid triage returns a payload and a request id", async () => {
  const response = await POST(
    request(JSON.stringify({ message: "Unauthorised Rs.12000 debit UTR 431289014421" })),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.ok(response.headers.get("x-request-id"));
  const body = (await response.json()) as { payload: { utr_number: string } };
  assert.equal(body.payload.utr_number, "431289014421");
});

test("a malformed body is a 400 with a typed error code", async () => {
  const response = await POST(request("{not json"));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "invalid_json");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("a schema violation is a 400 that names the field problem", async () => {
  const response = await POST(request(JSON.stringify({ message: "" })));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "invalid_input");
  assert.match(body.error.message, /message/i);
});

test("a non-json content type is rejected", async () => {
  const response = await POST(
    request("message=hello", { "Content-Type": "application/x-www-form-urlencoded" }),
  );
  assert.equal(response.status, 415);
});

test("an oversized body is rejected before it is buffered", async () => {
  const response = await POST(
    request(JSON.stringify({ message: "x".repeat(40_000) })),
  );
  assert.equal(response.status, 413);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "payload_too_large");
});

test("a spoofed content-length cannot bypass the size limit", async () => {
  const response = await POST(
    request(JSON.stringify({ message: "x".repeat(40_000) }), {
      "Content-Length": "10",
    }),
  );
  assert.equal(response.status, 413);
});

test("every error response carries a request id and no-store", async () => {
  const response = await POST(request("nope"));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { request_id: string } };
  assert.equal(typeof body.error.request_id, "string");
  assert.ok(body.error.request_id.length > 0);
});
