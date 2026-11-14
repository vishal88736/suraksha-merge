/**
 * Live check of a model server that also writes the customer reply: field
 * accuracy, how often its reply passes the safety checks (and why not), and
 * latency, over the reviewed test cases and the challenge set.
 *
 *   node scripts/eval-replies.ts http://127.0.0.1:8765
 */
import fs from "node:fs";
import { triageWithModel } from "../lib/model-triage.ts";

const url = process.argv[2]!;
const lines = (p: string) => fs.readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const inputs = new Map(lines("data/review/annotation_queue.jsonl").map((i) => [i.review_id, i.input]));
const cases = [
  ...lines("data/processed/upi-reviewed-v1/test-reviewed/benchmark.jsonl").map((b) => ({ set: "reviewed-test", input: inputs.get(b.sample_id), target: JSON.parse(b.target) })),
  ...lines("data/challenge/category-challenge-v1.jsonl").map((c) => ({ set: "challenge", input: { message: c.message }, target: { dispute_category: c.category } })),
];
const out: Record<string, { n: number; exact: number; used: number; modelReply: number; reasons: Record<string, number>; ms: number[] }> = {};
for (const c of cases) {
  const s = (out[c.set] ??= { n: 0, exact: 0, used: 0, modelReply: 0, reasons: {}, ms: [] });
  const t0 = performance.now();
  const r = await triageWithModel(c.input, { url, timeoutMs: 35000 });
  s.ms.push(performance.now() - t0);
  s.n++;
  const fields = Object.keys(c.target);
  if (fields.every((f) => JSON.stringify((r.payload as Record<string, unknown>)[f]) === JSON.stringify(c.target[f]))) s.exact++;
  if (r.audit.model.status === "used") {
    s.used++;
    const reply = r.audit.model.reply;
    if (reply?.source === "model") s.modelReply++;
    else for (const reason of reply?.reasons ?? ["none"]) s.reasons[reason] = (s.reasons[reason] ?? 0) + 1;
  }
}
for (const [set, s] of Object.entries(out)) {
  s.ms.sort((a, b) => a - b);
  console.log(JSON.stringify({ set, cases: s.n, correct: +(s.exact / s.n).toFixed(3), model_used: s.used, model_reply_used: s.modelReply, template_reasons: s.reasons, median_s: +(s.ms[Math.floor(s.n / 2)]! / 1000).toFixed(1) }));
}
