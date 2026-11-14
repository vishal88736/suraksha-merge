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

test("a merchant QR scan is not a collect-request scam", () => {
  const r = triage({
    message:
      "Paid by QR scan at the shop, Rs.500 was debited but the merchant did not get it and the order failed. UTR 431289014421",
  });
  assert.equal(r.payload.dispute_category, "P2M_CONFIRMATION_FAILURE");
  assert.equal(r.sla.deadline_days, 5);
  assert.ok(!r.payload.mandatory_actions.includes("CALL_1930"));
});

test("a QR code alone never signals a scam", () => {
  const r = triage({
    message:
      "QR scan failed at BigBasket store, Rs.849 debited, order not confirmed, money stuck. UTR 431289014421",
  });
  assert.equal(r.payload.dispute_category, "P2M_CONFIRMATION_FAILURE");
  assert.equal(r.sla.deadline_days, 5);
});

test("fraud evidence outranks a wrong-account mention", () => {
  const r = triage({
    message:
      "Someone hacked my UPI and pushed money to a wrong account. UTR 431289014421",
  });
  assert.equal(r.payload.dispute_category, "UNAUTHORIZED_ACCOUNT_TAKEOVER");
  assert.ok(r.payload.mandatory_actions.includes("CALL_1930"));
  assert.ok(r.payload.mandatory_actions.includes("REPORT_CYBERCRIME"));
});

test("prose numbers never become transaction amounts", () => {
  const r = triage({
    message:
      "Rs.2000 debited from my account 2 hours 30 minutes ago. UTR 431289014421",
  });
  assert.equal(r.payload.amount_inr, 2000);
});

test("a word ending in rs is not a currency token", () => {
  const r = triage({
    message: "Rs.500 debited for 3 customers 5000 orders. UTR 431289014421",
  });
  assert.equal(r.payload.amount_inr, 500);
});

test("identity keywords at any distance block the reference", () => {
  for (const message of [
    "Adhar ref 123456789012",
    "Aadhaar of the good old customer ref no 123456789012",
    "UIDAI ref 123456789012",
    "a/c ref 123456789012",
  ]) {
    const r = redactPII(message);
    assert.ok(!r.sanitized.includes("123456789012"), message);
    assert.equal(r.anchors.length, 0, message);
  }
});

test("a labelled transaction reference still survives", () => {
  const r = redactPII("UPI Ref No 431289014421 and RRN 512345678901");
  assert.match(r.sanitized, /431289014421/);
  assert.match(r.sanitized, /512345678901/);
});

test("unlabelled long digit runs are masked", () => {
  const r = redactPII("My ID is 1234567890 and email x@y.com");
  assert.ok(!r.sanitized.includes("1234567890"));
});

test("post-2027 technical transactions require revalidation", () => {
  const r = triage({
    message:
      "UPI transfer Rs.1500 debited beneficiary not credited UTR 431289014421",
    transaction_date: "2027-01-01",
    elapsed_calendar_days: 2,
  });
  assert.equal(r.payload.rbi_liability_tier, "PENDING_VERIFICATION");
  assert.equal(r.sla.policy_revalidation_required, true);
  assert.ok(r.warnings.some((w) => w.includes("2027")));
});

test("utr_grounded reflects the source message, not the anchor set", () => {
  const r = triage({ message: fraud });
  assert.equal(r.audit.utr_grounded, true);
  assert.equal(r.payload.utr_number, "431289014421");
});

test("no delay compensation is quoted before the deadline", () => {
  const r = triage({
    message:
      "UPI transfer Rs.1500 debited beneficiary not credited UTR 431289014421",
    elapsed_calendar_days: 1,
  });
  assert.equal(r.sla.estimated_compensation_inr, 0);
  assert.match(r.reply.text, /No delay compensation is indicated yet/);
});

test("the liability cap states its basis when the amount is unknown", () => {
  const r = triage({
    message: "Unauthorised debit UTR 431289014421, please help",
    responsibility: "third_party",
    reporting_delay_working_days: 4,
    account_tier: "bsbd",
  });
  assert.equal(r.payload.amount_inr, null);
  assert.equal(r.sla.liability_cap_inr, 5000);
  assert.equal(r.sla.liability_cap_basis, "cap_only");
});

test("redaction stays linear on a long unpunctuated token", () => {
  const started = performance.now();
  const r = redactPII("a".repeat(12000));
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 50, `redaction took ${elapsed.toFixed(1)}ms`);
  assert.ok(r.sanitized.includes("[EMAIL_REDACTED]") === false);
});

test("calendar dates are real, including leap years", () => {
  for (const transaction_date of [
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "1899-12-31",
  ])
    assert.throws(() => triage({ message: "hi", transaction_date }));
  assert.doesNotThrow(() =>
    triage({ message: "hi", transaction_date: "2024-02-29" }),
  );
});
test("leading whitespace does not corrupt source offsets", () => {
  const message = "   Unauthorised Rs.100 UTR 431289014421";
  const result = triage({ message });
  const anchor = result.privacy.anchors[0]!;
  assert.equal(
    message.slice(anchor.start, anchor.end),
    result.payload.utr_number,
  );
  assert.equal(result.audit.utr_grounded, true);
});

test("amounts use exact decimal precision and valid grouping", () => {
  for (const [raw, value] of [
    ["₹1,23,456.78", 123456.78],
    ["INR 12,345,678.90", 12345678.9],
    ["Rs.0.50", 0.5],
  ] as const)
    assert.equal(triage({ message: raw }).payload.amount_inr, value);
  for (const raw of ["₹1,23,45", "Rs.12.345", "INR 99999999999999999999999999"])
    assert.equal(triage({ message: raw }).payload.amount_inr, null, raw);
});
test("Indic digits are handled without leaking identity or authentication numbers", () => {
  const message =
    "₹१,५०० UTR ४३१२८९०१४४२१ Aadhaar १२३४५६७८९०१२ phone ९८७६५४३२१० OTP 123456 PIN 4321";
  const r = triage({ message });
  assert.equal(r.payload.amount_inr, 1500);
  assert.equal(r.payload.utr_number, "431289014421");
  assert.equal(r.audit.utr_grounded, true);
  for (const value of ["१२३४५६७८९०१२", "९८७६५४३२१०", "123456", "4321"])
    assert.ok(!r.privacy.sanitized.includes(value), value);
});
test("numeric email and VPA identifiers are masked completely", () => {
  const r = redactPII("mail 9876543210@example.com vpa 9876543210@ybl");
  assert.ok(r.sanitized.includes("[EMAIL_REDACTED]"));
  assert.ok(r.sanitized.includes("[VPA_REDACTED]"));
  assert.ok(!r.sanitized.includes("@"));
});
test("a negated fraud claim does not override a voluntary transfer", () => {
  const r = triage({
    message:
      "This is not a scam. I voluntarily sent Rs.2000 to the wrong VPA by mistake. UTR 512345678901",
  });
  assert.equal(r.payload.dispute_category, "VOLUNTARY_WRONG_VPA_TRANSFER");
});
test("conflicting reporting windows never establish zero liability", () => {
  const r = triage({
    message:
      "Unauthorised Rs.500 debit, reported after 10 working days. UTR 431289014421",
    responsibility: "third_party",
    reporting_delay_working_days: 2,
  });
  assert.equal(r.payload.rbi_liability_tier, "PENDING_VERIFICATION");
  assert.equal(r.payload.reporting_delay_working_days, null);
});

// A currency-marked value is transaction data; the same digits alone remain PII.
test("large currency amounts are not mistaken for telephone numbers", () => {
  const message =
    "UPI Rs 9876543210.50 debited. Call 9876543210. RRN 431289014421";
  const result = triage({ message });
  assert.equal(result.payload.amount_inr, 9876543210.5);
  assert.ok(result.privacy.sanitized.includes("Rs 9876543210.50"));
  assert.ok(result.privacy.sanitized.includes("Call [PHONE_REDACTED]"));
});

test("a debited UPI transfer whose recipient ko mila nahi remains a P2P failure", () => {
  const result = triage({message: "UPI transaction kiya tha, paisa debited aur recipient ko mila nahi", language: "hinglish"});
  assert.equal(result.payload.dispute_category, "P2P_BENEFICIARY_NOT_CREDITED");
  assert.equal(result.payload.rbi_liability_tier, "TECHNICAL_T_PLUS_1");
});

test("a UTR is read from bank-statement narration, as found for failed payments", () => {
  for (const [message, utr] of [
    ["Payment failed but ₹500 debited. Statement shows UPI/612345678901/swiggy", "612345678901"],
    ["Failed transfer, ₹1,200 gone. Statement: UPI/DR/612345678902/RAVI KUMAR/YESB", "612345678902"],
    ["Pending UPI, ₹300 debited. Narration UPI-612345678903-SBIN", "612345678903"],
    ["Payment failed but ₹500 debited. UPI transaction ID 612345678904", "612345678904"],
  ] as const) {
    const result = triage({ message });
    assert.equal(result.payload.utr_number, utr, message);
    assert.ok(!result.payload.mandatory_actions.includes("REQUEST_UTR"), message);
  }
});

test("an unlabelled 12-digit number is still never taken as a UTR", () => {
  for (const message of [
    "Payment failed but ₹500 debited. 612345678901",
    "Payment failed, ₹500 debited. My Aadhaar is 612345678901",
    "UPI payment failed. Aadhaar UPI/612345678901",
  ]) {
    const result = triage({ message });
    assert.equal(result.payload.utr_number, null, message);
    assert.ok(result.payload.mandatory_actions.includes("REQUEST_UTR"), message);
    assert.match(result.reply.text, /transaction history|SMS/, message);
  }
});

test("receiver, payee and merchant phrasings from real complaints are classified", () => {
  const cases: [string, string][] = [
    ["paisa kat gaya but reciever ko nahi mila", "P2P_BENEFICIARY_NOT_CREDITED"],
    ["money deducted but not credited to payee", "P2P_BENEFICIARY_NOT_CREDITED"],
    ["paisa kat gaya but not recvd by other party!", "P2P_BENEFICIARY_NOT_CREDITED"],
    ["paise kat gaye par receiver didnt get", "P2P_BENEFICIARY_NOT_CREDITED"],
    ["Paisa kat gaya but merchant receive nhi hua", "P2M_CONFIRMATION_FAILURE"],
    ["money got cut but merchant saying he not receive anything", "P2M_CONFIRMATION_FAILURE"],
    ["paise kat gye UPI se aur maine koi transaction nahi kiya", "UNAUTHORIZED_ACCOUNT_TAKEOVER"],
    ["meri UPI se paise kat gaye, i did not do this tranjection!!", "UNAUTHORIZED_ACCOUNT_TAKEOVER"],
    ["paise kat gaye bina mere permission ke!", "UNAUTHORIZED_ACCOUNT_TAKEOVER"],
    ["mera UPI transaction fail ho gaya", "NEEDS_INFORMATION"],
    ["paise kat gaye lekin pohcha nahi", "NEEDS_INFORMATION"],
  ];
  for (const [message, category] of cases)
    assert.equal(triage({ message }).payload.dispute_category, category, message);
});

test("a needs-information reply does not ask again for an amount already given", () => {
  const withAmount = triage({ message: "UPI payment failed and ₹1,200 debited, what to do?" });
  assert.equal(withAmount.payload.dispute_category, "NEEDS_INFORMATION");
  assert.doesNotMatch(withAmount.reply.steps[0], /amount/i);
  const without = triage({ message: "UPI payment failed, what to do?" });
  assert.match(without.reply.steps[0], /amount/i);
});

test("a transaction date gives the elapsed days, compensation and due date", () => {
  const result = triage(
    { message: "Swiggy merchant payment ₹849 debited but order failed. UTR 612345678901", transaction_date: "2026-11-01" },
    { today: "2026-11-14" },
  );
  assert.equal(result.payload.dispute_category, "P2M_CONFIRMATION_FAILURE");
  assert.equal(result.sla.elapsed_calendar_days, 13);
  assert.equal(result.sla.elapsed_source, "transaction_date");
  assert.equal(result.sla.reversal_due_date, "2026-11-06");
  assert.equal(result.sla.estimated_compensation_inr, 800);
  assert.ok(result.payload.mandatory_actions.includes("REVIEW_COMPENSATION"));
  // An operator-supplied day count still wins over the date.
  const operator = triage(
    { message: "Swiggy merchant payment ₹849 debited but order failed. UTR 612345678901", transaction_date: "2026-11-01", elapsed_calendar_days: 3 },
    { today: "2026-11-14" },
  );
  assert.equal(operator.sla.elapsed_calendar_days, 3);
  assert.equal(operator.sla.estimated_compensation_inr, 0);
  const future = triage({ message: "UPI transfer ₹500 not credited to recipient. UTR 612345678901", transaction_date: "2026-12-01" }, { today: "2026-11-14" });
  assert.equal(future.sla.elapsed_calendar_days, null);
  assert.ok(future.warnings.some((w) => w.includes("after today")));
});
