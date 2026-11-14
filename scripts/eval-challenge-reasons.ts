/** Why the model's answer was or was not used on the challenge set. */
import fs from "node:fs";
import { triage } from "../lib/engine.ts";
import { triageWithModel } from "../lib/model-triage.ts";
const url = process.argv[2];
const rows = fs.readFileSync("data/challenge/category-challenge-v1.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const reasons: Record<string, number> = {};
let correct = 0, modelCategoryRight = 0;
for (const row of rows) {
  const r = await triageWithModel({ message: row.message }, { url, timeoutMs: 15000 });
  if (r.payload.dispute_category === row.category) correct++;
  const key = r.audit.model.status === "used" ? "used" : ("reasons" in r.audit.model ? r.audit.model.reasons : ["not_configured"]).join("+");
  reasons[key] = (reasons[key] ?? 0) + 1;
}
console.log(JSON.stringify({ pipeline_accuracy: +(correct / rows.length).toFixed(3), outcomes: reasons }));
void triage; void modelCategoryRight;
