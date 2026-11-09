import test from "node:test";
import assert from "node:assert/strict";
import {
  payloadSchema,
  policyCheck,
  redactPII,
  triage,
} from "../lib/engine.ts";
import { SCENARIOS } from "../lib/scenarios.ts";
const fraud = "Unauthorised Rs.12000 debit UTR 431289014421";
test("all scenarios produce strict schema and no fabricated actions", () => {
  for (const s of SCENARIOS) {
    const r = triage(s.input);
    assert.ok(payloadSchema.safeParse(r.payload).success);
    assert.equal(r.audit.no_unauthorized_promises, true, s.id);
    assert.equal(r.audit.fraud_rails_present, true, s.id);
    assert.equal(r.audit.external_actions_taken, false);
  }
});
test("unlabelled 12-digit IDs and Aadhaar are masked, labelled UTR survives", () => {
  const r = redactPII(
    "Aadhaar 123456789012, other 222233334444, UTR 431289014421, phone 9876543210, PAN ABCDE1234F, account 1234567890123456, a@okaxis, mail test@example.com",
  );
  assert.match(r.sanitized, /UTR 431289014421/);
  for (const value of [
    "123456789012",
    "222233334444",
    "9876543210",
    "ABCDE1234F",
    "1234567890123456",
    "a@okaxis",
    "test@example.com",
  ])
    assert.ok(!r.sanitized.includes(value), value);
  assert.ok(!JSON.stringify(r.redactions).includes("9876543210"));
});
test("Aadhaar falsely described as a reference is not whitelisted", () => {
  const r = redactPII("Aadhaar ref 123456789012");
  assert.ok(!r.sanitized.includes("123456789012"));
});
test("spaced Aadhaar and international Indian phones are masked", () => {
  const r = redactPII("Aadhaar 1234 5678 9012 call +91 9876543210");
  assert.ok(!r.sanitized.includes("9012"));
  assert.ok(!r.sanitized.includes("9876543210"));
});
test("conflicting UTRs and amounts abstain", () => {
  const r = triage({
    message:
      "UPI transfer failed Rs.500 vs Rs.600 UTR 431289014421 RRN 512345678901",
  });
  assert.equal(r.payload.utr_number, null);
  assert.equal(r.payload.amount_inr, null);
  assert.equal(r.audit.utr_grounded, null);
});
test("technical P2P uses T+1 calendar days", () => {
  const r = triage({
    message:
      "UPI transfer Rs.1500 debited beneficiary not credited UTR 431289014421",
    elapsed_calendar_days: 3,
  });
  assert.equal(r.sla.deadline_days, 1);
  assert.equal(r.sla.estimated_compensation_inr, 200);
});
test("merchant confirmation uses T+5 and penalty starts after deadline", () => {
  for (const day of [4, 5, 6]) {
    const r = triage({ ...SCENARIOS[1].input, elapsed_calendar_days: day });
    assert.equal(r.sla.deadline_days, 5);
    assert.equal(r.sla.estimated_compensation_inr, Math.max(0, day - 5) * 100);
  }
});
test("early reporting with unknown responsibility does not imply zero liability", () => {
  assert.equal(
    triage({ message: fraud, reporting_delay_working_days: 0 }).payload
      .rbi_liability_tier,
    "PENDING_VERIFICATION",
  );
});
for (const [days, tier] of [
  [0, "ZERO_LIABILITY_ELIGIBLE"],
  [3, "ZERO_LIABILITY_ELIGIBLE"],
  [4, "LIMITED_LIABILITY_ELIGIBLE"],
  [7, "LIMITED_LIABILITY_ELIGIBLE"],
  [8, "BANK_POLICY_REVIEW"],
] as const)
  test(`third-party reporting boundary ${days}`, () => {
    assert.equal(
      triage({
        message: fraud,
        responsibility: "third_party",
        reporting_delay_working_days: days,
      }).payload.rbi_liability_tier,
      tier,
    );
  });
test("bank negligence does not lose eligibility from delay alone", () => {
  assert.equal(
    triage({
      message: fraud,
      responsibility: "bank",
      reporting_delay_working_days: 100,
    }).payload.rbi_liability_tier,
    "ZERO_LIABILITY_ELIGIBLE",
  );
});
test("customer negligence goes to review even when prompt", () => {
  assert.equal(
    triage({
      message: fraud,
      responsibility: "customer",
      reporting_delay_working_days: 0,
    }).payload.rbi_liability_tier,
    "CUSTOMER_NEGLIGENCE_REVIEW",
  );
});
test("BSBD cap includes ₹5000 and never exceeds transaction amount", () => {
  const r = triage({
    message: fraud,
    responsibility: "third_party",
    reporting_delay_working_days: 4,
    account_tier: "bsbd",
  });
  assert.equal(r.sla.liability_cap_inr, 5000);
  assert.equal(
    triage({
      message: fraud.replace("12000", "2000"),
      responsibility: "third_party",
      reporting_delay_working_days: 4,
      account_tier: "regular",
    }).sla.liability_cap_inr,
    2000,
  );
});
test("calendar-day text does not become working-day evidence", () => {
  assert.equal(
    triage({ message: fraud + " 2 days ago" }).payload
      .reporting_delay_working_days,
    null,
  );
});
test("prompt injection cannot approve refunds or change a tier", () => {
  const r = triage(SCENARIOS[2].input);
  assert.equal(r.payload.rbi_liability_tier, "PENDING_VERIFICATION");
  assert.equal(r.payload.amount_inr, 90000);
  assert.ok(!r.reply.text.includes("approved"));
});
test("voluntary wrong transfer is not auto-reversed", () => {
  const r = triage(SCENARIOS[4].input);
  assert.equal(r.payload.rbi_liability_tier, "BANK_POLICY_REVIEW");
  assert.ok(!r.payload.mandatory_actions.includes("CALL_1930"));
});
test("future policy boundary abstains", () => {
  assert.equal(
    triage({
      message: fraud,
      responsibility: "bank",
      transaction_date: "2027-01-01",
    }).payload.rbi_liability_tier,
    "PENDING_VERIFICATION",
  );
});
test("reject invalid, empty, oversized, extra and nonfinite inputs", () => {
  for (const x of [
    { message: "" },
    { message: "x".repeat(12001) },
    { message: "hi", reporting_delay_working_days: -1 },
    { message: "hi", responsibility: "fake" },
    { message: "hi", bad: true },
  ])
    assert.throws(() => triage(x as never));
  assert.equal(
    payloadSchema.safeParse({
      ...triage({ message: "hi" }).payload,
      amount_inr: Infinity,
    }).success,
    false,
  );
});
test("unsupported references do not become a UPI RRN", () => {
  assert.equal(
    triage({ message: "UTR ABCD1234EFGH debit Rs.100" }).payload.utr_number,
    null,
  );
});
test("promise scorer detects common unsafe claims", () => {
  const p = triage({ message: fraud }).payload;
  for (const r of [
    "100% refund guaranteed",
    "instant reversal approved",
    "we guarantee full chargeback",
    "pakka paise wapas aa jayega",
    "Your dispute has been filed",
  ])
    assert.equal(policyCheck(r, p).no_unauthorized_promises, false, r);
});

test("sentence punctuation does not hide a conflicting amount", () => {
  assert.equal(
    triage({ message: "Rs.100 debit or Rs.200. UTR 431289014421" }).payload
      .amount_inr,
    null,
  );
});
