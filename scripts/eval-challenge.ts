/**
 * Category accuracy on the author-labelled challenge set, for the rules alone
 * and, when a model server URL is given, for the full model-first pipeline.
 *
 *   node scripts/eval-challenge.ts [http://127.0.0.1:8765]
 */
import fs from "node:fs";
import { triage } from "../lib/engine.ts";
import { triageWithModel } from "../lib/model-triage.ts";

const url = process.argv[2];
const rows = fs.readFileSync("data/challenge/category-challenge-v1.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const score = { rules: 0, pipeline: 0, model_used: 0, model_category: 0 };
const misses: string[] = [];
for (const row of rows) {
  const rules = triage({ message: row.message }).payload.dispute_category;
  if (rules === row.category) score.rules++;
  let pipeline = rules;
  if (url) {
    const result = await triageWithModel({ message: row.message }, { url, timeoutMs: 60000 });
    pipeline = result.payload.dispute_category;
    if (result.audit.model.status === "used") score.model_used++;
  }
  if (pipeline === row.category) score.pipeline++;
  if (rules !== row.category || pipeline !== row.category)
    misses.push(`${row.id} ${row.language} want ${row.category} | rules ${rules} | pipeline ${pipeline}`);
}
console.log(JSON.stringify({ cases: rows.length, rules_accuracy: +(score.rules / rows.length).toFixed(3), pipeline_accuracy: url ? +(score.pipeline / rows.length).toFixed(3) : null, model_used: url ? score.model_used : null }, null, 2));
for (const m of misses) console.log(m);
