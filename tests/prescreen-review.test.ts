import test from "node:test";
import assert from "node:assert/strict";
import { prescreen } from "../scripts/prescreen-review.ts";
import { triage } from "../lib/engine.ts";

const input = { message: "Unauthorised Rs.12000 debit UTR 431289014421", language: "english" as const };
const label = triage(input).payload;
const item = {
  review_id: "t-1", split: "train", origin: "synthetic", scenario_group: "g",
  input, expected_json: label,
  chosen_reply: triage(input).reply.text,
  rejected_reply: "Your refund is 100% guaranteed. The dispute is already filed.",
  provenance: {},
};

test("a consistent case has no flags and is never a human review", () => {
  const row = prescreen(item);
  assert.equal(row.ai_priority, "none");
  assert.equal(row.is_human_review, false);
});

test("ungrounded facts, unsafe replies and weak pairs are flagged", () => {
  const codes = prescreen({
    ...item,
    expected_json: { ...label, utr_number: "999999999999", rbi_liability_tier: "ZERO_LIABILITY_ELIGIBLE" },
    chosen_reply: "Refund guaranteed.",
    rejected_reply: "Refund guaranteed.",
  }).flags.map((f) => f.code);
  for (const code of ["rules_disagree_utr_number", "utr_not_in_message", "rules_disagree_rbi_liability_tier", "chosen_reply_promise_pattern", "chosen_equals_rejected"])
    assert.ok(codes.includes(code), code);
});
