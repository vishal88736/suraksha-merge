/**
 * Measured results shown in the Benchmark lab. Every number comes from a run
 * recorded in docs/VERIFICATION.md; `source` names the file that holds it
 * (artifacts/ is local and not in Git). Nothing here is a target or estimate.
 */

export type Measured = {
  model: string;
  /** Short description of training data and mode. */
  detail: { en: string; hi: string };
  /** 54 held-out reviewed cases, all 8 fields exact. */
  reviewedAllFields: string;
  /** 42 unfamiliar-wording challenge cases, category correct. */
  challengeCategory: string;
  /** Answers flagged for human review (model authority only). */
  review: string;
  latency: string;
  source: string;
  highlight?: "served" | "default";
};

export const MEASURED_AT = "15 Nov 2026";

export const CURRENT_RESULTS: Measured[] = [
  {
    model: "Base Qwen2.5-3B-Instruct",
    detail: { en: "no fine-tuning", hi: "बिना फ़ाइन-ट्यूनिंग" },
    reviewedAllFields: "0 valid outputs",
    challengeCategory: "—",
    review: "—",
    latency: "3–4 s",
    source: "artifacts/reviewed/eval/base.jsonl",
  },
  {
    model: "Rules only",
    detail: { en: "keyword rules + templates, no model", hi: "कीवर्ड नियम + टेम्पलेट, बिना मॉडल" },
    reviewedAllFields: "100%*",
    challengeCategory: "45.2%",
    review: "—",
    latency: "< 0.1 s",
    source: "scripts/eval-challenge.ts",
  },
  {
    model: "Round 2 SFT",
    detail: { en: "598 reviewed cases · rules as safety net", hi: "598 समीक्षित केस · नियम सुरक्षा-जाल" },
    reviewedAllFields: "90.7%",
    challengeCategory: "59.5%†",
    review: "—",
    latency: "2–4 s",
    source: "artifacts/reviewed/eval/reviewed-sft.jsonl",
  },
  {
    model: "Round 3 SFT",
    detail: { en: "765 reviewed cases · rules as safety net", hi: "765 समीक्षित केस · नियम सुरक्षा-जाल" },
    reviewedAllFields: "96.3%",
    challengeCategory: "81.0%",
    review: "—",
    latency: "2–4 s",
    source: "artifacts/reviewed/eval/reviewed-sft-002.jsonl, challenge-r002-now.txt",
  },
  {
    model: "Round 4 SFT · merged-schema-sft-004",
    detail: { en: "810 reviewed cases · rules as safety net", hi: "810 समीक्षित केस · नियम सुरक्षा-जाल" },
    reviewedAllFields: "98.1%",
    challengeCategory: "90.5%",
    review: "—",
    latency: "2–4 s",
    source: "artifacts/reviewed/eval/runtime-004.json, challenge-r004-now.txt",
    highlight: "served",
  },
  {
    model: "Round 4 JSON + reply · merged-dual-sft-004",
    detail: {
      en: "810 reviewed cases · model writes everything",
      hi: "810 समीक्षित केस · हर उत्तर मॉडल लिखता है",
    },
    reviewedAllFields: "55.6%",
    challengeCategory: "76.2%",
    review: "22/54 · 28/42",
    latency: "11–12 s",
    source: "artifacts/reviewed/eval/authority-dual-004.json",
    highlight: "default",
  },
];

/** Round 1: unreviewed pilots, raw model output scored by AuditKIT on 92 synthetic cases. */
export const PILOT_RESULTS = [
  { model: "Base Qwen2.5-3B-Instruct", utility: "0.00", allFields: "0.00", latency: "8.0 s" },
  { model: "Schema SFT", utility: "0.86", allFields: "0.73", latency: "13.2 s" },
  { model: "Dual SFT (schema + reply)", utility: "0.90", allFields: "0.74", latency: "19.4 s" },
  { model: "Merged schema SFT", utility: "0.86", allFields: "0.71", latency: "8.1 s" },
  { model: "Schema SFT → DR-GRPO", utility: "0.87", allFields: "0.75", latency: "14.3 s" },
  { model: "Schema + empathy-DPO merge", utility: "0.56", allFields: "0.00", latency: "—" },
] as const;
