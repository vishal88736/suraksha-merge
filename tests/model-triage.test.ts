import test from "node:test";
import assert from "node:assert/strict";
import { triage, inputSchema } from "../lib/engine.ts";
import { triageWithModel, validateModelPayload } from "../lib/model-triage.ts";
import { modelConfigFromEnv, runWithModelConfig } from "../lib/model-config.ts";
import { modelHealth } from "../lib/model-health.ts";
import { triageResponseSchema } from "../lib/triage-response.ts";
import { createTriageHandler } from "../lib/triage-api.ts";

// Fixture model replies only: these test the integration contract, not model quality.
const MESSAGE =
  "Bhai please help!! OLX buyer QR scan kiya Rs.24500 kat gaye. UTR 431289014421.";
const MODEL = {
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  base_revision: "aa8e72537993ba99e69dfaafa59ed015b17504d1",
  adapter: null,
  adapter_sha256: null,
  quantization: "nf4",
  unreviewed_pilot: false,
};
const GOOD = {
  utr_number: "431289014421",
  dispute_category: "COLLECT_REQUEST_SCAM",
  amount_inr: 24500,
  reporting_delay_working_days: null,
  rbi_liability_tier: "PENDING_VERIFICATION",
  mandatory_actions: [
    "CONTACT_BANK_PSP",
    "SECURE_PAYMENT_CHANNEL",
    "CALL_1930",
    "REPORT_CYBERCRIME",
    "RAISE_APP_DISPUTE",
    "HUMAN_REVIEW",
  ],
  detected_language: "hinglish",
  panic_severity: "HIGH_CRITICAL",
};
const CONFIG = { url: "http://127.0.0.1:8765", timeoutMs: 5_000 };

function fakeServer(raw: string, seen: unknown[] = []) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Response.json({ raw, latency_ms: 812.4, model: MODEL });
  }) as typeof fetch;
}

function check(raw: string, overrides: Record<string, unknown> = {}) {
  const input = inputSchema.parse({ message: MESSAGE, ...overrides });
  return validateModelPayload(raw, input, triage(input));
}

test("a strict, grounded model payload is used and the response validates", async () => {
  const seen: { url: string; body: { message: string; context: object } }[] = [];
  const result = await triageWithModel(
    { message: MESSAGE, reporting_delay_working_days: 0 },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, reporting_delay_working_days: 0 }), seen),
  );
  assert.equal(result.audit.mode, "model_validated");
  assert.equal(result.audit.model.status, "used");
  assert.equal(result.payload.dispute_category, "COLLECT_REQUEST_SCAM");
  assert.equal(result.audit.utr_grounded, true);
  assert.ok(result.reply.text.includes("1930"));
  triageResponseSchema.parse(result);
  // The model receives the redacted message and only operator context.
  assert.equal(seen[0]!.url, "http://127.0.0.1:8765/v1/triage");
  assert.deepEqual(seen[0]!.body.context, { reporting_delay_working_days: 0 });
  assert.equal(seen[0]!.body.message, triage({ message: MESSAGE }).privacy.sanitized);
});

test("observed base-model output (prefix, misspelled key) falls back without repair", async () => {
  const observed = `JSON:\n${JSON.stringify(GOOD).replace("panic_severity", "pac_severity")}`;
  const result = await triageWithModel({ message: MESSAGE }, CONFIG, fakeServer(observed));
  assert.equal(result.audit.mode, "deterministic_preview");
  assert.deepEqual(result.audit.model, {
    status: "fallback",
    reasons: ["not_strict_json"],
    model: MODEL,
    latency_ms: 812.4,
  });
  assert.deepEqual(result.payload, triage({ message: MESSAGE }).payload);
  triageResponseSchema.parse(result);
  const misspelled = JSON.stringify(GOOD).replace("panic_severity", "pac_severity");
  assert.deepEqual(check(misspelled), { ok: false, reasons: ["schema_invalid"] });
});

test("ungrounded facts and unsupported liability conclusions are rejected", () => {
  assert.deepEqual(check(JSON.stringify({ ...GOOD, utr_number: "999999999999" })).ok, false);
  assert.deepEqual(check(JSON.stringify({ ...GOOD, utr_number: "999999999999" })), {
    ok: false,
    reasons: ["utr_not_grounded"],
  });
  assert.deepEqual(check(JSON.stringify({ ...GOOD, amount_inr: 25000 })), {
    ok: false,
    reasons: ["amount_not_grounded"],
  });
  // The base model claimed zero liability with no operator evidence in the probe.
  assert.deepEqual(
    check(JSON.stringify({ ...GOOD, rbi_liability_tier: "ZERO_LIABILITY_ELIGIBLE" })),
    { ok: false, reasons: ["tier_not_supported_by_operator_context"] },
  );
  // With verified bank responsibility, rules reach the same tier, so it is accepted.
  assert.equal(
    check(JSON.stringify({ ...GOOD, rbi_liability_tier: "ZERO_LIABILITY_ELIGIBLE" }), {
      responsibility: "bank",
    }).ok,
    true,
  );
  assert.deepEqual(
    check(JSON.stringify({ ...GOOD, rbi_liability_tier: "TECHNICAL_T_PLUS_1" })),
    { ok: false, reasons: ["tier_inconsistent_with_category"] },
  );
  assert.deepEqual(
    check(JSON.stringify({ ...GOOD, mandatory_actions: ["CONTACT_BANK_PSP", "HUMAN_REVIEW"] })),
    { ok: false, reasons: ["fraud_rails_missing"] },
  );
  assert.deepEqual(
    check(JSON.stringify({ ...GOOD }), { transaction_date: "2027-02-01" }).ok,
    true,
  );
  assert.deepEqual(
    check(JSON.stringify({ ...GOOD, rbi_liability_tier: "BANK_POLICY_REVIEW" }), {
      transaction_date: "2027-02-01",
    }),
    { ok: false, reasons: ["tier_requires_policy_revalidation"] },
  );
  assert.deepEqual(check(JSON.stringify({ ...GOOD, detected_language: "english" }), { language: "hinglish" }), {
    ok: false,
    reasons: ["language_conflicts_with_operator"],
  });
  assert.deepEqual(check(`${JSON.stringify(GOOD).slice(0, -1)}, "utr_number": null}`), {
    ok: false,
    reasons: ["not_strict_json"],
  });
});

test("server failures fall back to rules with a typed reason", async () => {
  const down = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const error = (async () => new Response("{}", { status: 500 })) as typeof fetch;
  const bad = (async () => Response.json({ raw: 1 })) as typeof fetch;
  for (const [impl, reason] of [
    [down, "model_unavailable"],
    [error, "model_http_500"],
    [bad, "model_unavailable"],
  ] as const) {
    const result = await triageWithModel({ message: MESSAGE }, CONFIG, impl);
    assert.equal(result.audit.model.status, "fallback");
    assert.deepEqual(
      result.audit.model.status === "fallback" && result.audit.model.reasons,
      [reason],
    );
    triageResponseSchema.parse(result);
  }
});

test("without a configured model the rules engine reports not_configured", async () => {
  const result = await triageWithModel({ message: MESSAGE }, undefined);
  assert.deepEqual(result.audit.model, { status: "not_configured" });
  const response = await createTriageHandler()(
    new Request("https://suraksha.test/api/triage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: MESSAGE }),
    }),
  );
  const body = triageResponseSchema.parse(await response.json());
  assert.equal(body.audit.mode, "deterministic_preview");
});

test("model endpoint must be loopback http; timeout is bounded", () => {
  assert.equal(modelConfigFromEnv({}), undefined);
  assert.equal(modelConfigFromEnv({ SURAKSHA_MODEL_URL: "https://example.com" }), undefined);
  assert.equal(modelConfigFromEnv({ SURAKSHA_MODEL_URL: "http://10.0.0.5:8765" }), undefined);
  assert.equal(modelConfigFromEnv({ SURAKSHA_MODEL_URL: "not a url" }), undefined);
  assert.deepEqual(
    modelConfigFromEnv({
      SURAKSHA_MODEL_URL: "http://127.0.0.1:8765/",
      SURAKSHA_MODEL_TIMEOUT_MS: "999999",
    }),
    { url: "http://127.0.0.1:8765", token: undefined, timeoutMs: 15_000 },
  );
  assert.equal(
    runWithModelConfig(CONFIG, () => modelConfigFromEnv({ SURAKSHA_MODEL_URL: "http://localhost:1" })?.url),
    "http://localhost:1",
  );
});

test("health distinguishes a base model from a fine-tuned one", async () => {
  assert.equal((await modelHealth(undefined)).model_endpoint_configured, false);
  const serve = (fine_tuned: boolean) =>
    (async () =>
      Response.json({ status: "ok", model: { ...MODEL, fine_tuned } })) as typeof fetch;
  const base = await modelHealth(CONFIG, serve(false));
  assert.equal(base.model_reachable, true);
  assert.equal(base.trained_model_connected, false);
  assert.equal((await modelHealth(CONFIG, serve(true))).trained_model_connected, true);
  const pilot = (async () =>
    Response.json({ status: "ok", model: { ...MODEL, fine_tuned: true, unreviewed_pilot: true } })) as typeof fetch;
  assert.equal((await modelHealth(CONFIG, pilot)).trained_model_connected, false);
  const down = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  assert.equal((await modelHealth(CONFIG, down)).model_reachable, false);
});

test("a language the pilot was not trained on is answered by rules without calling the model", async () => {
  const seen: unknown[] = [];
  const result = await triageWithModel(
    { message: "আমার UPI থেকে ₹500 কেটে গেছে কিন্তু টাকা পৌঁছায়নি। UTR 612345678901" },
    CONFIG,
    fakeServer(JSON.stringify(GOOD), seen),
  );
  assert.equal(seen.length, 0);
  assert.equal(result.payload.detected_language, "bengali");
  assert.deepEqual(result.audit.model, {
    status: "fallback",
    reasons: ["language_outside_model_training"],
    model: null,
    latency_ms: null,
  });
});

test("a model whose only error is the liability tier is used, with the tier set by policy rules", async () => {
  const result = await triageWithModel(
    { message: MESSAGE, reporting_delay_working_days: 0 },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, reporting_delay_working_days: 0, rbi_liability_tier: "ZERO_LIABILITY_ELIGIBLE" })),
  );
  assert.equal(result.audit.model.status, "used");
  assert.equal(result.payload.rbi_liability_tier, "PENDING_VERIFICATION");
  assert.deepEqual(result.audit.model.status === "used" && result.audit.model.policy_from_rules?.tier, {
    model: "ZERO_LIABILITY_ELIGIBLE",
    rules: "PENDING_VERIFICATION",
  });
  assert.equal(triageResponseSchema.safeParse(result).success, true);
});

test("missing policy actions are supplied by the rules, and the audit says so", async () => {
  const actions = GOOD.mandatory_actions.filter((a) => a !== "HUMAN_REVIEW");
  const result = await triageWithModel(
    { message: MESSAGE, reporting_delay_working_days: 0 },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, reporting_delay_working_days: 0, mandatory_actions: actions })),
  );
  assert.equal(result.audit.model.status, "used");
  assert.ok(result.payload.mandatory_actions.includes("HUMAN_REVIEW"));
  assert.deepEqual(
    result.audit.model.status === "used" && result.audit.model.policy_from_rules?.actions,
    { added: ["HUMAN_REVIEW"], removed: [] },
  );
});

test("a tier error alongside an ungrounded fact still falls back to rules", async () => {
  const result = await triageWithModel(
    { message: MESSAGE },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, utr_number: "999999999999", rbi_liability_tier: "ZERO_LIABILITY_ELIGIBLE" })),
  );
  assert.equal(result.audit.model.status, "fallback");
});

test("the model may not discard the rules' category evidence", async () => {
  const vague = await triageWithModel(
    { message: "Swiggy merchant payment ₹849 debited but order failed. UTR 612345678901" },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, utr_number: "612345678901", amount_inr: 849, dispute_category: "NEEDS_INFORMATION", rbi_liability_tier: "PENDING_VERIFICATION", mandatory_actions: ["CONTACT_BANK_PSP", "REQUEST_TRANSACTION_DETAILS", "HUMAN_REVIEW"], detected_language: "english", panic_severity: "LOW" })),
  );
  assert.equal(vague.audit.model.status, "fallback");
  assert.ok(vague.audit.model.status === "fallback" && vague.audit.model.reasons.includes("model_less_specific_than_rules"));
  assert.equal(vague.payload.dispute_category, "P2M_CONFIRMATION_FAILURE");

  const missedFraud = await triageWithModel(
    { message: MESSAGE },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, dispute_category: "P2P_BENEFICIARY_NOT_CREDITED", rbi_liability_tier: "TECHNICAL_T_PLUS_1", mandatory_actions: ["CONTACT_BANK_PSP", "RAISE_APP_DISPUTE", "TRACK_REVERSAL"] })),
  );
  assert.equal(missedFraud.audit.model.status, "fallback");
  assert.ok(missedFraud.audit.model.status === "fallback" && missedFraud.audit.model.reasons.includes("model_misses_fraud_signal"));
});

test("the model may not replace a category the rules found with a different one", async () => {
  const result = await triageWithModel(
    { message: "गलती से गलत UPI ID पर ₹1,600 भेज दिए। UTR 612345600139" },
    CONFIG,
    fakeServer(JSON.stringify({ utr_number: "612345600139", dispute_category: "P2P_BENEFICIARY_NOT_CREDITED", amount_inr: 1600, reporting_delay_working_days: null, rbi_liability_tier: "TECHNICAL_T_PLUS_1", mandatory_actions: ["CONTACT_BANK_PSP", "RAISE_APP_DISPUTE", "TRACK_REVERSAL"], detected_language: "hindi_devanagari", panic_severity: "LOW" })),
  );
  assert.equal(result.audit.model.status, "fallback");
  assert.ok(result.audit.model.status === "fallback" && result.audit.model.reasons.includes("model_contradicts_rules_category"));
  assert.equal(result.payload.dispute_category, "VOLUNTARY_WRONG_VPA_TRANSFER");
});

test("with several references or amounts the model may not pick one", async () => {
  const message = "Two debits: ₹500 UTR 612345678901 and ₹700 UTR 612345678902, recipient did not get either transfer.";
  const rules = triage({ message });
  assert.equal(rules.payload.utr_number, null);
  assert.equal(rules.payload.amount_inr, null);
  const pick = (utr: string | null, amount: number | null) =>
    validateModelPayload(
      JSON.stringify({ utr_number: utr, dispute_category: "P2P_BENEFICIARY_NOT_CREDITED", amount_inr: amount, reporting_delay_working_days: null, rbi_liability_tier: "TECHNICAL_T_PLUS_1", mandatory_actions: ["CONTACT_BANK_PSP", "RAISE_APP_DISPUTE", "TRACK_REVERSAL", "REQUEST_UTR"], detected_language: "english", panic_severity: "LOW" }),
      inputSchema.parse({ message }),
      rules,
    );
  assert.deepEqual(pick("612345678901", null), { ok: false, reasons: ["utr_ambiguous"] });
  assert.deepEqual(pick(null, 700), { ok: false, reasons: ["amount_ambiguous"] });
  assert.equal(pick(null, null).ok, true);
});

test("urgency cannot be lowered and the language must match the message", async () => {
  const urgent = await triageWithModel(
    { message: MESSAGE, reporting_delay_working_days: 0 },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, reporting_delay_working_days: 0, panic_severity: "LOW" })),
  );
  assert.equal(urgent.audit.model.status, "used");
  assert.equal(urgent.payload.panic_severity, "HIGH_CRITICAL");
  assert.deepEqual(urgent.audit.model.status === "used" && urgent.audit.model.policy_from_rules?.panic, { model: "LOW", rules: "HIGH_CRITICAL" });

  const wrongLanguage = await triageWithModel(
    { message: MESSAGE },
    CONFIG,
    fakeServer(JSON.stringify({ ...GOOD, detected_language: "tamil" })),
  );
  assert.equal(wrongLanguage.audit.model.status, "fallback");
  assert.ok(wrongLanguage.audit.model.status === "fallback" && wrongLanguage.audit.model.reasons.includes("language_not_grounded"));
});

test("a remote model endpoint needs an explicit opt-in, https and a token", () => {
  const remote = { SURAKSHA_MODEL_URL: "https://inference.example.org", SURAKSHA_MODEL_TOKEN: "t" };
  assert.equal(modelConfigFromEnv(remote), undefined);
  assert.equal(modelConfigFromEnv({ ...remote, SURAKSHA_MODEL_ALLOW_REMOTE: "true", SURAKSHA_MODEL_TOKEN: "" }), undefined);
  assert.equal(modelConfigFromEnv({ ...remote, SURAKSHA_MODEL_ALLOW_REMOTE: "true", SURAKSHA_MODEL_URL: "http://inference.example.org" }), undefined);
  assert.deepEqual(modelConfigFromEnv({ ...remote, SURAKSHA_MODEL_ALLOW_REMOTE: "true" }), {
    url: "https://inference.example.org", token: "t", timeoutMs: 15_000,
  });
});

test("a busy model server falls back to rules at once", async () => {
  const busy = (async () => new Response(JSON.stringify({ error: "busy" }), { status: 503 })) as typeof fetch;
  const result = await triageWithModel({ message: MESSAGE }, CONFIG, busy);
  assert.deepEqual(result.audit.model, { status: "fallback", reasons: ["model_busy"], model: null, latency_ms: null });
});
