/**
 * AI pre-screen of the human-review queue. It never records a review decision
 * and never marks anything as human-reviewed: it writes independent automated
 * flags so a human reviewer can prioritise. Output rows carry
 * `is_human_review: false`.
 *
 *   node scripts/prescreen-review.ts [queue.jsonl] [output.jsonl]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { triage, policyCheck, isFraud, type Payload } from "../lib/engine.ts";
import { findAmounts } from "../lib/numbers.ts";

type Item = {
  review_id: string;
  split: string;
  origin: string;
  scenario_group: string;
  input: Record<string, unknown> & { message: string };
  expected_json: Payload;
  chosen_reply: string;
  rejected_reply: string | null;
  provenance: { synthetic_status?: string; source_provenance?: unknown };
};
type Flag = { code: string; severity: "high" | "medium" | "low"; detail: string };

const FIELDS = [
  "utr_number",
  "dispute_category",
  "amount_inr",
  "reporting_delay_working_days",
  "rbi_liability_tier",
  "mandatory_actions",
  "detected_language",
  "panic_severity",
] as const;
const POLICY_FIELDS = new Set(["rbi_liability_tier", "mandatory_actions", "dispute_category"]);

function same(field: string, a: unknown, b: unknown) {
  if (field === "mandatory_actions")
    return JSON.stringify([...(a as string[])].sort()) === JSON.stringify([...(b as string[])].sort());
  return a === b;
}

function devanagariShare(text: string) {
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => /\p{Script=Devanagari}/u.test(c)).length / letters.length;
}

export function prescreen(item: Item) {
  const flags: Flag[] = [];
  const label = item.expected_json;
  const message = item.input.message;

  // 1. Independent re-derivation by the current deterministic rules engine.
  let rules: Payload | null = null;
  try {
    rules = triage(item.input as never).payload;
  } catch (error) {
    flags.push({ code: "rules_engine_error", severity: "high", detail: String(error).slice(0, 120) });
  }
  if (rules)
    for (const field of FIELDS)
      if (!same(field, rules[field], label[field]))
        flags.push({
          code: `rules_disagree_${field}`,
          severity: POLICY_FIELDS.has(field) || field === "utr_number" || field === "amount_inr" ? "high" : "medium",
          detail: `label=${JSON.stringify(label[field])} rules=${JSON.stringify(rules[field])}`,
        });

  // 2. Grounding of numeric facts in the customer's own text.
  const digits = message.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
  if (label.utr_number && !digits.includes(label.utr_number))
    flags.push({ code: "utr_not_in_message", severity: "high", detail: label.utr_number });
  const amounts = findAmounts(message);
  if (label.amount_inr !== null && !amounts.hits.some((h) => h.value === label.amount_inr))
    flags.push({ code: "amount_not_in_message", severity: "high", detail: String(label.amount_inr) });
  if (label.amount_inr === null && amounts.hits.length === 1 && !amounts.invalid)
    flags.push({ code: "amount_present_but_label_null", severity: "medium", detail: String(amounts.hits[0]!.value) });

  // 3. Chosen reply: the same policy gates used for training, plus language script.
  const policy = policyCheck(item.chosen_reply, label);
  if (!policy.no_unauthorized_promises)
    flags.push({ code: "chosen_reply_promise_pattern", severity: "high", detail: "guarantee/filed-dispute wording" });
  if (!policy.fraud_rails_present)
    flags.push({ code: "chosen_reply_missing_fraud_rails", severity: "high", detail: "1930 / cybercrime.gov.in / bank" });
  if (label.utr_number && !item.chosen_reply.includes(label.utr_number) && isFraud(label.dispute_category))
    flags.push({ code: "chosen_reply_omits_utr", severity: "low", detail: label.utr_number });
  const share = devanagariShare(item.chosen_reply);
  if (label.detected_language === "hindi_devanagari" && share < 0.3)
    flags.push({ code: "reply_script_mismatch", severity: "medium", detail: `devanagari share ${share.toFixed(2)} for hindi_devanagari` });
  if (label.detected_language !== "hindi_devanagari" && share > 0.3)
    flags.push({ code: "reply_script_mismatch", severity: "medium", detail: `devanagari share ${share.toFixed(2)} for ${label.detected_language}` });

  // 4. Preference pair: the rejected reply must be genuinely worse.
  if (!item.rejected_reply)
    flags.push({ code: "no_rejected_reply", severity: "low", detail: "no DPO pair" });
  else {
    const bad = policyCheck(item.rejected_reply, label);
    if (bad.no_unauthorized_promises && bad.fraud_rails_present)
      flags.push({ code: "rejected_reply_not_a_policy_violation", severity: "medium", detail: "pair may not teach a policy preference" });
    if (item.rejected_reply.trim() === item.chosen_reply.trim())
      flags.push({ code: "chosen_equals_rejected", severity: "high", detail: "identical pair" });
  }

  // 5. Provenance context reviewers should know.
  if (item.origin !== "synthetic" || item.provenance?.source_provenance)
    flags.push({ code: "public_source_case", severity: "low", detail: "publisher-declared synthetic public data; verify adaptation" });

  const rank = { high: 3, medium: 2, low: 1 } as const;
  const top = flags.reduce((m, f) => Math.max(m, rank[f.severity]), 0);
  return {
    review_id: item.review_id,
    split: item.split,
    scenario_group: item.scenario_group,
    ai_priority: top === 3 ? "high" : top === 2 ? "medium" : top === 1 ? "low" : "none",
    flags,
    generated_by: "ai_prescreen",
    is_human_review: false,
    note: "Automated flags only. A human reviewer must still decide every case with the review CLI.",
  };
}

const isMain = process.argv[1]?.endsWith("prescreen-review.ts");
if (isMain) {
  const queuePath = process.argv[2] ?? "data/review/annotation_queue.jsonl";
  const outPath = process.argv[3] ?? "data/review/ai_prescreen.jsonl";
  const raw = readFileSync(queuePath, "utf8");
  const items = raw.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Item);
  const rows = items.map(prescreen);
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const counts = { high: 0, medium: 0, low: 0, none: 0 } as Record<string, number>;
  const codes: Record<string, number> = {};
  for (const r of rows) {
    counts[r.ai_priority]!++;
    for (const f of r.flags) codes[f.code] = (codes[f.code] ?? 0) + 1;
  }
  const summary = {
    queue: queuePath,
    queue_sha256: createHash("sha256").update(raw).digest("hex"),
    items: rows.length,
    by_priority: counts,
    flag_counts: Object.fromEntries(Object.entries(codes).sort((a, b) => b[1] - a[1])),
    is_human_review: false,
  };
  writeFileSync(outPath.replace(/\.jsonl$/, ".summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}
