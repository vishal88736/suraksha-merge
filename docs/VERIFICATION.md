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
