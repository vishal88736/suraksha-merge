/**
 * Live evaluation of model authority: the model writes the whole answer
 * (payload and reply), checks only flag it. Runs against a model server.
 *
 *   node scripts/eval-authority.ts http://127.0.0.1:8765 > artifacts/reviewed/eval/authority-XXX.json
 *
 * Reports, on the 54 held-out reviewed cases and the 42 challenge cases:
 * how often the model's own payload is right, how often the answer needed
 * human review (any failed check after the retry), which checks failed, and
 * how often no answer could be produced at all.
 */
import fs from "node:fs";
import { triageWithModel } from "../lib/model-triage.ts";
import type { TriageInput } from "../lib/engine.ts";

const url = process.argv[2] ?? "http://127.0.0.1:8765";
const config = { url, timeoutMs: 120_000, authority: "model" as const };
const lines = (p: string) => fs.readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const FIELDS = ["utr_number", "dispute_category", "amount_inr", "reporting_delay_working_days", "rbi_liability_tier", "mandatory_actions", "detected_language", "panic_severity"] as const;

type Case = { id: string; input: TriageInput; target?: Record<string, unknown>; category: string };
const inputs = new Map(lines("data/review/annotation_queue.jsonl").map((i) => [i.review_id, i.input]));
const reviewed: Case[] = lines("data/processed/upi-reviewed-v1/test-reviewed/benchmark.jsonl").map((b) => {
  const target = JSON.parse(b.target);
  return { id: b.sample_id, input: inputs.get(b.sample_id), target, category: target.dispute_category };
});
const challenge: Case[] = lines("data/challenge/category-challenge-v1.jsonl").map((r) => ({ id: r.id, input: { message: r.message }, category: r.category }));

async function run(label: string, cases: Case[]) {
  const s = { cases: cases.length, category: 0, all_fields: 0, review_required: 0, no_answer: 0, reply_passed: 0, payload_retried: 0, reply_retried: 0, seconds: [] as number[] };
  const payloadFlags: Record<string, number> = {};
  const replyFlags: Record<string, number> = {};
  const misses: string[] = [];
  for (const c of cases) {
    const t = Date.now();
    try {
      const r = await triageWithModel(c.input, config);
      s.seconds.push((Date.now() - t) / 1000);
      const a = r.audit.model.status === "used" ? r.audit.model.authority : undefined;
      if (!a) throw new Error("not model authority");
      if (r.payload.dispute_category === c.category) s.category++;
      else misses.push(`${c.id} want ${c.category} got ${r.payload.dispute_category}`);
      if (c.target && FIELDS.every((f) => JSON.stringify(r.payload[f]) === JSON.stringify(c.target![f]))) s.all_fields++;
      if (a.review_required) s.review_required++;
      if (!a.reply_flags.length) s.reply_passed++;
      if (a.attempts.payload > 1) s.payload_retried++;
      if (a.attempts.reply > 1) s.reply_retried++;
      for (const f of a.payload_flags) payloadFlags[f] = (payloadFlags[f] ?? 0) + 1;
      for (const f of a.reply_flags) replyFlags[f] = (replyFlags[f] ?? 0) + 1;
    } catch (error) {
      s.no_answer++;
      misses.push(`${c.id} no answer: ${(error as Error).message}`);
    }
  }
  const sorted = [...s.seconds].sort((x, y) => x - y);
  return {
    set: label, cases: s.cases,
    category_correct: +(s.category / s.cases).toFixed(3),
    ...(label === "reviewed-test" ? { all_fields_exact: +(s.all_fields / s.cases).toFixed(3) } : {}),
    needs_human_review: s.review_required, no_answer: s.no_answer, reply_passed_checks: s.reply_passed,
    payload_retried: s.payload_retried, reply_retried: s.reply_retried,
    median_seconds: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    payload_flags: payloadFlags, reply_flags: replyFlags, misses,
  };
}

console.log(JSON.stringify([await run("reviewed-test", reviewed), await run("challenge", challenge)], null, 2));
