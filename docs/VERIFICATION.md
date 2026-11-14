# Verification record

Implementation check on 10 November 2026. These are local implementation and fixture checks; current GitHub Actions status is recorded separately by the commit's Actions run.

| Surface                           | Observed result            | Scope                                                                                                                                        |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                        | Pass                       | `npm run check`                                                                                                                              |
| App regressions                   | 87 passed                  | API, financial-policy rules, exact amounts, contextual PII, locale coverage, client contracts, request races and stale-result handling       |
| Research regressions              | 24 passed                  | Curation, strict rewards, split isolation, paired bootstrap, checkpoint resolution, hashes, dataset paths and pinned revision loading        |
| Dependency audit                  | Zero known vulnerabilities | `npm audit`; production and development dependency graph at the verification date                                                            |
| Production build                  | Pass                       | Vinext 1.4.4 / Vite 8 / React 19.3 Worker build                                                                                              |
| Built Worker HTTP integration     | 12 checks passed           | 40 synthetic HTTP requests; HTML routes, health, key enforcement, rate limit, Indic budget, PII, malformed JSON, dates and size/media limits |
| CuratorKIT 0.1.21                 | Pass                       | Actual schema/clean/exact-dedup/Alpaca export over 20 sanitized training records                                                             |
| AuditKIT 1.1.6                    | Pass                       | Actual custom scorers over five valid and five unsafe fixtures, labelled `SCORER_FIXTURE_VERIFICATION`                                       |
| GPU/model training                | Not run                    | NVIDIA driver unavailable; no model weights downloaded                                                                                       |
| Presidio                          | Not run                    | Optional integration needs the configured NLP model                                                                                          |
| Browser visual/interaction review | Unverified                 | Browser-control tools are unavailable in this session; successful HTML responses do not establish browser behavior                           |
| Bank/NPCI action                  | None                       | Decision-support draft only                                                                                                                  |

The HTTP check is repeatable against a fresh local built Worker. Its burst check deliberately uses the local rate budget. CI starts an isolated Worker before running it:

```bash
npm run build
npm run start -- --port 8791 --var TRIAGE_API_KEY:local-smoke-fixture-only
# In another terminal; this value is a synthetic test key:
TRIAGE_SMOKE_API_KEY=local-smoke-fixture-only node scripts/smoke-http.mjs http://127.0.0.1:8791
```

The rate limiter is bounded and local to a Worker isolate. Distributed quota enforcement and operational bank integrations remain deployment decisions. The runtime redactor covers tested contextual patterns; it is not a general guarantee of detecting every identity format.

No measured six-checkpoint model comparison, regional-language human empathy study, inference-cost result or production compliance certification is claimed. Source-pinned GPU commands still need execution and validation on the training host.

## Public-source curation, 12 November 2026

The [data-curation record](DATA_CURATION.md) covers the current run. Downloaded eight pinned payload files (36,868 rows); ran actual CuratorKIT normalization, schema, exact/MinHash deduplication, Alpaca and DPO exports; retained 934 unreviewed cases with grouped 758/84/92 splits. Independent artifact checks cover schema, provenance, masking idempotence, numeric grounding, preference patterns and split/benchmark exclusion. All 19 core JSONL files were byte-identical on a cached rerun; toolkit/run timestamps are excluded.

Current local checks: 45 Python regressions (including actual CuratorKIT tests), 89 application regressions, TypeScript and production build passed. The public-data workflow does not execute AuditKIT scorer fixtures, model benchmarking or AlignTune training. No Presidio NLP model or target tokenizer was run. Human review count remains zero, and default training is blocked. Earlier fixture observations above retain their original date and scope.

## Human-review and training preparation, 12 November 2026

Current local verification: 61 Python regressions, 89 application regressions, TypeScript and production build passed. Review queues contain 934 pending annotation cases and 92 pending evaluation candidates, with seven-category/five-language coverage and family/near-duplicate isolation. No human decisions were generated. All 34 original corpus artifact hashes remain unchanged.

CPU smoke-data checks passed for two synthetic fixtures. Trainer/reward registration and checkpoint/manifest contracts are tested with explicit mocks and temporary fixture bytes. Actual AlignTune training, actual embedding tensors and real checkpoint saving remain blocked by unavailable training dependencies and insufficient VRAM for the current configuration. Qwen tokenizer metadata bounds and actual raw token lengths were checked using tokenizers 0.22.2. See [the preparation runbook](HUMAN_REVIEW_AND_TRAINING.md) for exact results, commands and pending runtime checks.

## Human review, reviewed training and evaluation, 14 November 2026

**Review.**
- 652 of 934 annotation cases are reviewed (553 accepted, 99 corrected) and 4 are rejected. That covers every English, Hindi and Hinglish case; 278 Tanglish and Marathi–English cases await a native speaker.
- One reviewer (`vishal`) worked from an AI pre-audit (Claude, against the reviewer's checklist), signing off each batch table. Each decision's notes record this.
- 29 corrections initially carried an amount copied from a reference case by the pre-audit tooling. The curation gate caught them (`numeric_annotation_not_supported_after_masking`), and they were re-corrected to `amount_inr: null`.
- The evaluation queue (92 cases) still needs an independent second reviewer, so `finalize-evaluation` has not been run.

**Curation and training.**
- `export-curation --languages english hindi_devanagari hinglish` gives 598 reviewed train and validation cases. CuratorKIT curation accepts all 598 and rejects 0 (`data/processed/upi-reviewed-v1`).
- `phase2 --stage curated-sft --profile laptop-6gb --reviewed-laptop`: 69 steps, `parameters_updated: true`, loss 0.005.
- The adapter was merged on CPU in bf16 (`artifacts/reviewed/merged-schema-sft-001`, kind `reviewed_merged_base`).

**Evaluation** (54 reviewed test cases, English/Hindi/Hinglish, synthetic; `artifacts/reviewed/eval/`):
- **AuditKIT on raw model output:**
  - reviewed SFT: utility 0.737, all-fields 0.519;
  - pilot SFT: 0.852 / 0.704;
  - base: 0 / 0 (never schema-valid).
  Both fine-tuned models are 100% schema-valid with 0 category errors. Their remaining errors are in actions, tier and panic severity.
- **Runtime pipeline** (`scripts/eval-runtime.ts`: model output → gates → policy rules own tier and actions), all-fields exact:
  - rules only: 100%;
  - pilot: 94.4%;
  - reviewed SFT: 90.7%;
  - base: 100%, via 54 fallbacks.
  The remaining model errors are panic severity only.
- The benchmark labels are engine-consistent by construction (curation gate plus review). This set therefore cannot show a model improving on the rules. Evaluation on real, human-labelled messages is still required.

**Languages.**
- The interface and replies are machine-translated into 21 scheduled languages with IndicTrans2 and back-translation checks. 9 of 546 reply templates fall back to English (lib/i18n/generated/QA.md).
- Native-script classification keywords are covered by 20 samples.
- None of this text is reviewed by native speakers.

**Checks.** 115 application tests, 77 Python tests, TypeScript, lint (0 errors), production build, built-Worker HTTP smoke (12 checks) and a CSP browser check (no violations).

**Live check of the served reviewed model.** On two messages phrased unlike the synthetic data (a Swiggy merchant failure, and a Hinglish "maine koi transaction nahi kiya"), the model answered `NEEDS_INFORMATION`. That passed the gates and overrode the rules' correct P2M and fraud answers. Two gates now stop the model from discarding the rules' evidence: `model_less_specific_than_rules` and `model_misses_fraud_signal`. With these gates, both messages are answered correctly, and a vague message still gets the model's `NEEDS_INFORMATION`. The model's category accuracy on real, varied phrasing is unmeasured.

**Unfamiliar-wording challenge set** (`data/challenge/category-challenge-v1.jsonl`; 42 author-labelled cases, not human-reviewed; `scripts/eval-challenge.ts`).
- **Rules alone:** category accuracy 38.1%. Every rules error was `NEEDS_INFORMATION`; they never named a wrong category.
- **Reviewed SFT pipeline:** 54.8% at first. The model sometimes contradicted a correct rules category (for example, wrong-VPA → P2P).
- **After the gate change:** the model may only refine `NEEDS_INFORMATION` (`model_contradicts_rules_category`), and the pipeline reaches **57.1%**. The reviewed benchmark is unchanged at 90.7%.

## Round 3: varied wording, 14 November 2026

**What was reviewed.**
- `scripts/author_variations.ts` wrote 168 hand-worded complaints (7 categories × English/Hinglish/Hindi × 8).
- The author assigned each category. Every other label was derived by the policy rules for that category, and each case is held below 0.6 trigram similarity to the challenge set.
- They were reviewed in three batches by `vishal` with an AI pre-audit. Before review, the pre-audit fixed two generator contradictions (day counts, a customer who denies sharing credentials).
- One earlier label was corrected: `public:cucom:62aaa1c6d93ce79bdd` panic HIGH → MEDIUM. Its HIGH came from a substring match of "help me" inside "help mera".

**Fixes that went in with this round.**
- **Urgency rule:** "help me" now needs an urgency marker.
- **phase1:** authored variations are treated as synthetic.
- **Curation gate:** for human-reviewed rows, the engine runs with the reviewer's category, and every policy field is still checked.
- **`public_target`:** an amount followed by a full stop is no longer dropped. That bug had quarantined 7 reviewed cases.

**Curation.** 765 of 766 accepted (`data/processed/upi-reviewed-v2`; one CuratorKIT near-duplicate). `--reviewed-laptop`: 87 steps, parameters updated. Merged into `artifacts/reviewed/merged-schema-sft-002`.

**Gate fixes found while evaluating.**
- **Language:** `language_not_grounded` was rejecting 15–19 of 42 challenge answers. The rules detect all 42 languages correctly, so in auto mode the rules now own the language, and the change is recorded in `policy_from_rules.language`.
- **Tier check:** evidence tiers were compared with the rules' NEEDS_INFORMATION tier instead of the policy tier for the model's category.

**Results, both models under the final gates.**

| Model | Reviewed test, all fields exact | Challenge, category accuracy |
|---|---:|---:|
| Rules only | 100% | 38.1% |
| Round 2 (598 reviewed cases) | 90.7% | 59.5% |
| Round 3 (765 cases) | 96.3% | 73.8% |

## Round 4: cases from live testing, 14 November 2026

**Why.** Fresh messages typed into the running site exposed rules and model gaps: billers and apps ("electricity board", Ola, DTH), "declined" and "order not placed", amounts without a currency mark ("Paid 1,850"), an OTP or PIN given to a caller, a QR scanned "to receive money", and a bill split with a friend read as a merchant payment.

**Rules.** Each gap was fixed in `lib/rules/classification.ts` and `lib/numbers.ts` (mirrored in `research/dataset_quality.py`), with regression tests. The engine still agrees with all 930 reviewed categories and all 820 reviewed amounts. Rules-only challenge accuracy: 38.1% → 45.2%.

**Data.** `scripts/author_variations_v2.ts` wrote 45 cases (16 English, 15 Hinglish, 14 Hindi) for those gaps plus negatives, checked against the challenge set and the first variation set (trigram Jaccard ≤ 0.6). Pre-audited by Claude; vishal signed off on the batch (`data/review/variation_decisions.v2.jsonl`). Writing them exposed further Devanagari and Hinglish keyword gaps, fixed before training. Corpus export also picked up three amount corrections signed off after round 3.

**Curation.** 810 of 811 accepted (`data/processed/upi-reviewed-v3`; one CuratorKIT near-duplicate). The held-out test split is byte-identical to round 3's. `--reviewed-laptop`: 92 steps, train loss 0.046, parameters updated. Merged into `artifacts/reviewed/merged-schema-sft-004`.

**Results, both models under today's gates and rules.**

| Model | Reviewed test, all fields exact | Challenge, category accuracy | Challenge, model answer used |
|---|---:|---:|---:|
| Rules only | 100% | 45.2% | n/a |
| Round 3 (765 cases) | 96.3% | 81.0% | 36 of 42 |
| Round 4 (810 cases) | 98.1% | 90.5% | 40 of 42 |

Files: `artifacts/reviewed/eval/runtime-004.json`, `challenge-r002-now.txt`, `challenge-r004-now.txt`. Six fresh user-style messages: all final answers correct; the model's own answer was used for 2, the rules overruled it for 4.

**Caveat.** The 45 new cases were written after looking at failures, by the same author as the challenge set. The challenge gain may overstate the improvement on real messages.

