/**
 * Score the runtime pipeline (model output -> gates -> policy rules) on
 * recorded predictions, against a reviewed benchmark.
 *
 *   node scripts/eval-runtime.ts BENCHMARK QUEUE LABEL=PREDICTIONS ...
 *
 * Each recorded model output is replayed through triageWithModel exactly as
 * the server would return it; the final payload is compared with the
 * reviewed target. Rules-only is reported as a baseline.
 */
import fs from "node:fs";
import { triage } from "../lib/engine.ts";
import { triageWithModel } from "../lib/model-triage.ts";

const [benchmarkPath, queuePath, ...runs] = process.argv.slice(2);
const lines = (p: string) => fs.readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const bench = lines(benchmarkPath);
const inputs = new Map(lines(queuePath).map((i) => [i.review_id, i.input]));
const FIELDS = ["utr_number", "dispute_category", "amount_inr", "reporting_delay_working_days", "rbi_liability_tier", "mandatory_actions", "detected_language", "panic_severity"] as const;
const MODEL = { base_model: "replay", base_revision: "0".repeat(40), adapter: null, adapter_sha256: null, quantization: "nf4", unreviewed_pilot: false };

type Score = { n: number; allExact: number; fields: Record<string, number>; used: number; fallback: number };
const empty = (): Score => ({ n: 0, allExact: 0, fields: Object.fromEntries(FIELDS.map((f) => [f, 0])), used: 0, fallback: 0 });
function add(score: Score, payload: Record<string, unknown>, target: Record<string, unknown>) {
  score.n++;
  let all = true;
  for (const f of FIELDS) {
    const ok = JSON.stringify(payload[f]) === JSON.stringify(target[f]);
    if (ok) score.fields[f]++;
    else all = false;
  }
  if (all) score.allExact++;
}
const report = (label: string, s: Score) => ({
  label, cases: s.n,
  all_fields_exact: +(s.allExact / s.n).toFixed(3),
  model_used: s.used, rules_fallback: s.fallback,
  per_field: Object.fromEntries(FIELDS.map((f) => [f, +(s.fields[f] / s.n).toFixed(3)])),
});

const out = [];
const rules = empty();
for (const b of bench) add(rules, triage(inputs.get(b.sample_id)).payload, JSON.parse(b.target));
out.push(report("rules-only", rules));
for (const run of runs) {
  const [label, path] = run.split("=");
  const preds = new Map(lines(path).map((p) => [p.sample_id, String(p.prediction).split("---REPLY---")[0].trim()]));
  const score = empty();
  for (const b of bench) {
    const raw = preds.get(b.sample_id) ?? "";
    const server = (async () => Response.json({ raw, latency_ms: 1, model: MODEL })) as unknown as typeof fetch;
    const result = await triageWithModel(inputs.get(b.sample_id), { url: "http://127.0.0.1:1", timeoutMs: 1000 }, server);
    if (result.audit.model.status === "used") score.used++;
    else score.fallback++;
    add(score, result.payload, JSON.parse(b.target));
  }
  out.push(report(label, score));
}
console.log(JSON.stringify(out, null, 2));
