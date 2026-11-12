# Public data curation

Executed locally on 12 November 2026. This extends `phase1_curatorkit_pipeline.py`; it does not train a model. The generated corpus has **934 examples**, including **259 publicly sourced CuCom examples** and **675 locally authored synthetic examples**. **Zero examples are human-reviewed.** All public contribution here is itself publisher-declared synthetic dialogue, not operational bank evidence.

## Reproduce the run

From the repository root, with Node 22.18+ and Python 3.12+:

```bash
npm ci
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-public-data.txt
.venv/bin/python scripts/prepare_public_data.py --stage audit
.venv/bin/python scripts/prepare_public_data.py --stage download
.venv/bin/python scripts/prepare_public_data.py --stage prepare
.venv/bin/python scripts/validate_prepared_data.py
.venv/bin/python -m unittest discover -s research -p 'test_*.py' -v
npm test
npm run check
npm run build
```

`--stage all` combines the three acquisition/preparation stages. `--stage prepare` reuses verified local originals without network access. `--raw`, `--output` and `--benchmarks` select separate local directories; pass matching `--output` and `--benchmarks` to the validator. The public-source requirements install the real pinned CuratorKIT and PyArrow without Presidio NLP models or GPU libraries. `requirements-curation.txt` remains the optional enhanced hygiene environment.

Source cards and availability are audited before payload download. The committed [source lock](../data/public_sources.lock.json) contains immutable revisions, original filenames, column contracts, licenses, attribution URLs and SHA-256 hashes for both cards and payloads. Existing raw files are reused only if their bytes match that lock. Interrupted acquisition can resume; preparation refuses an incomplete acquisition or modified manifest. No dataset-supplied Python code executes.

Eight selected payload files were downloaded: **19,617,596 bytes**, containing **36,868 rows**. Cards/licenses and local manifests are additional small files. The original downloads remain separate from derived data.

## Source decisions

All five requested sources were publicly available at their pinned revisions. File formats and actual columns were inspected. Counts below refer to the selected downloads, not an assertion about every file in each upstream repository.

| Source | License | Downloaded rows | Format and columns | Use in this run |
| --- | --- | ---: | --- | --- |
| [BANKING77](https://huggingface.co/datasets/PolyAI/banking77) | CC BY 4.0 | 13,083 | Two Parquet files; `text`, `label` (77 banking intents) | Inspection/auxiliary only. No explicit UPI dispute evidence; zero core examples. |
| [IndicJevBench](https://huggingface.co/datasets/cmul8-hf/IndicJevBench) | CC BY 4.0 | 11,480 | JSONL; `id`, `family`, `lang`, `state`, `question`, `expected`, `split`, `source`, `license`, `provenance` | Frozen external benchmark only, retaining original task labels. |
| [CuCom banking](https://github.com/vakyansh/cucom) | Apache 2.0 | 9,858 | ZIP containing JSONL; `id`, `turns` with `role`/`content` | 270 first-user-turn candidates; 259 accepted. Publisher-declared synthetic support conversations. |
| [Indian Scam/Ham](https://huggingface.co/datasets/anmolshrivastav/scam-ham-india) | Apache 2.0 | 2,272 | `scam_hum_india.csv`; `text`, `label`; 1,377 ham / 895 spam | Inspected and excluded from core: SMS/promotion/scam content is not evidence that a customer completed a disputed UPI transaction. |
| [Chakravyuh-Bench](https://huggingface.co/spaces/ujjwalpardeshi/chakravyuh/blob/main/DATASET_CARD.md) | CC BY 4.0 for dataset | 175 | JSONL; `id`, `source`, `attack_sequence`, `ground_truth`, `metadata`, `split` | All reserved as external reconstructed scam scenarios; no training or model benchmarking. |

Revisions:

- BANKING77: `1846984189f2bc0ac51c6fc3a600fa9e1714e0c6`.
- IndicJevBench: `9cb880ef1c20c94d930d90b8e40d01819b5fa037`.
- CuCom: `60b9a7f9670e2176330b0576e232be4ec5a7fe19`.
- Scam/Ham: `09afd479908c443e46be2629185ba8cd1de8abb8`.
- Chakravyuh: `21968356f74a59ef29ddc274aba3ebc1ac321c6e`.

IndicJevBench subsets: `fintech_banking77` 7,816; `hinglish_lid` 3,220; `synthetic_enterprise` 444. Its general MASSIVE-intent file was not downloaded because it is unrelated to UPI disputes. CuCom ecommerce data and its redundant sample were also skipped. Chakravyuh's dataset card specifies CC BY 4.0; the Space's MIT code metadata is not used as the dataset license. Its scenarios are reconstructed and single-annotator-labelled, not victim transcripts. IndicJevBench includes translated/derived and synthetic tasks. Scam/Ham mixes real and synthetic texts without reliable per-record origin labels.

Source licenses remain attached to each derived public record. Original cards and the CuCom Apache license are preserved in raw metadata; this project does not relicense third-party content as independently verified bank data.

## Processing and annotation boundaries

The entry point is [scripts/prepare_public_data.py](../scripts/prepare_public_data.py). [research/data_sources.py](../research/data_sources.py) handles acquisition and bounded native readers; ZIP members are streamed without extraction, with path and expansion checks. [research/prepare_dataset.py](../research/prepare_dataset.py) inspects rows and calls the existing phase-one `curate` function.

Public selection requires an explicit UPI/VPA marker and customer payment-dispute evidence. A PSP brand by itself is insufficient. Fee, promotion and unrelated banking-intent records are rejected conservatively. Only the first user turn of each CuCom conversation is considered; source assistant claims about refunds, tickets or actions never become target facts.

[research/dataset_quality.py](../research/dataset_quality.py) maps suitable source evidence to the existing application categories. Public annotations are labelled `programmatic_silver_unreviewed`. UTR, amount and reporting delay remain null unless explicitly supported; unsupported/conflicting values are not fabricated. An unknown responsibility remains pending verification. The rule engine checks consistency and masks supported PII patterns; it does not author the public target or provide independent verification.

[research/synthetic_upi.py](../research/synthetic_upi.py) generates 700 deterministic authored cases: 70 scenario families, five languages and two evidence/policy variants. Targets come from explicit authored facts, with generator version and facts recorded. Cases cover technical P2P/P2M failures, collect and remote-access scams, account takeover, wrong-VPA transfers, missing evidence, reporting windows, customer negligence, bank responsibility and the future policy boundary. After gates, 675 remain. Their label is `synthetic_specification_unreviewed`; none is labelled human-reviewed.

Chosen replies use the existing regional-language policy templates. Rejected DPO replies are explicitly synthetic unsafe-guarantee mutations, not observed model failures or human preference ratings. The same reply prompt is used for chosen and rejected. Recovery logs call this deterministic template replacement, not an LLM RewardRefiner operation.

The eight payload fields remain unchanged: `utr_number`, `dispute_category`, `amount_inr`, `reporting_delay_working_days`, `rbi_liability_tier`, `mandatory_actions`, `detected_language`, `panic_severity`. Targets use the repository's existing policy constraints: separate calendar-day T+1/T+5 technical deadlines, conditional fraud liability, no automatic wrong-VPA refund promise, reporting rails and the 2027 policy-review boundary. These application categories are not an official NPCI submission contract.

## Real CuratorKIT execution

The run used **CuratorKIT 0.1.21**, pinned at `cee1aed21d14992f650c5dfe09094b9625d0ce87`. [research/curator_bridge.py](../research/curator_bridge.py) feeds actual toolkit survivors into the existing gates. There are no simulated toolkit calls.

| Executed operation | Input | Output | Notes |
| --- | ---: | ---: | --- |
| JSONLReader, SchemaGate, TextCleaner, AlpacaExporter | 970 | 970 | Actual Unicode/encoding/whitespace/control-character normalization of masked input. HTML-like injection text is preserved. |
| JSONLReader, SchemaGate, ExactDeduplicator, AlpacaExporter | 970 | 970 | Separate pass catches duplicates after normalization; upstream dedup ordering precedes cleaning. |
| MinHashDeduplicator, AlpacaExporter | 970 | 966 | Character trigrams, 128 permutations, seed 42, threshold 0.96; 396 annotation/context partitions preserve critical counterfactuals. |
| Existing schema, numeric, policy-pattern and engine-consistency gates | 966 | 934 | Mismatches quarantined, never silently relabelled from engine predictions. |
| Final training SchemaGate and AlpacaExporter | 1,516 | 1,516 | SFT training records. |
| Preference SchemaGate and DPOExporter | 758 | 758 | Same-task preference training pairs. |

`min_tokens=1` avoids excluding short Indic examples by whitespace length. This is not tokenizer adaptation or model-specific token counting. The existing 12,000-UTF-16-character application limit remains enforced.

Contextual regex masking ran before toolkit work files and exports. Only context-labelled 12-digit UTR/RRN anchors survive. Unlabelled 12-digit numbers and supported phone/account/Aadhaar/PAN/email/VPA patterns are masked. Public numeric labels are checked again after masking; a redacted identifier cannot reappear through a target. Comprehensive name/address recognition and Presidio NLP **did not run**. No semantic HallucinationGate, LLM judge, remote generation provider or adaptive LLM recovery was executed.

## Actual outputs and distributions

| Split | Examples | Share | Families | RLVR / DR-GRPO | DPO pairs | Curated SFT | Uncurated SFT control |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 758 | 81.16% | 54 | 758 | 758 | 1,516 | 1,516 |
| Validation | 84 | 8.99% | 9 | 84 | 84 | 168 | 168 |
| Test | 92 | 9.85% | 10 | 92 | 92 | 184 | 184 |
| Total | 934 | 100% | 73 | 934 | 934 | 1,868 | 1,868 |

SFT has two records per case: schema extraction and customer reply. RLVR contains `prompt`, `answer` and `ground_truth_json`, compatible with the existing AlignTune field mapping. The uncurated control shares masked inputs/splits and intentionally uses labelled unsafe synthetic reply negatives; it is an ablation input, not a customer-response dataset.

| Dispute category | Accepted |
| --- | ---: |
| `P2M_CONFIRMATION_FAILURE` | 97 |
| `P2P_BENEFICIARY_NOT_CREDITED` | 103 |
| `COLLECT_REQUEST_SCAM` | 97 |
| `REMOTE_ACCESS_SCAM` | 97 |
| `UNAUTHORIZED_ACCOUNT_TAKEOVER` | 154 |
| `VOLUNTARY_WRONG_VPA_TRANSFER` | 97 |
| `NEEDS_INFORMATION` | 289 |

| Language | Accepted |
| --- | ---: |
| English | 137 |
| Hindi Devanagari | 140 |
| Hinglish | 377 |
| Tanglish | 140 |
| Marathi-English | 140 |

Distribution is uneven because unrelated records are excluded rather than forced into fraud categories. Public-language labels are heuristic and await review. All 259 public-source cases are in train: their unknown upstream template relationships are conservatively grouped by source/category, rather than treating each conversation as an independent family. Validation/test therefore assess authored synthetic families only. They cannot establish public-data generalization.

Family assignment is deterministic (seed 42), approximately 80/10/10, stratified by category. Translations and evidence/policy counterfactuals stay together. Normalized numeric/template duplicates and near duplicates are co-grouped across sources. Checks found **zero family overlap** and **zero normalized-text overlap** across splits. This is a mechanical leakage check, not a semantic leakage guarantee.

The separate external benchmark contains **11,655 records** (IndicJevBench 11,480 and Chakravyuh 175), with original task labels and no fabricated eight-field triage gold. Five pre-existing synthetic test seeds remain reserved as regression fixtures. Normalized exact overlap with the new core corpus is zero. No checkpoint was evaluated on either benchmark.

## Rejection and quality reports

Source selection rejected 24,943 rows:

| Reason | Rows |
| --- | ---: |
| Banking intent without UPI dispute gold | 13,083 |
| No explicit UPI channel | 9,423 |
| SMS is not a customer dispute report | 2,240 |
| No customer payment-dispute evidence | 137 |
| Promotion, fee or unrelated context | 60 |

Of 970 core candidates (270 public + 700 local synthetic), 36 were rejected during toolkit/local gates: four near duplicates and 32 downstream rejections. Engine-consistency mismatch occurs on 32 records; four of those also fail the reply-policy pattern gate, so reason counts overlap. No rejected target is promoted to ground truth merely because the engine predicted something else.

The batch bridge now decodes UTF-8 incrementally, preserving Indic characters even when pipe chunks split a code point. A forced-boundary regression covers the corruption found during reproducibility checks.

The independent artifact validator checked all manifest file hashes, strict eight-field schema, unique IDs, task alignment, DPO guarantee/rail patterns, split isolation, benchmark exclusion Unicode replacement characters, and masking idempotence for all 934 inputs. Numeric provenance was rechecked for all 259 accepted public rows, with zero unsupported numeric fields. These results validate pipeline mechanics, not annotation correctness or language quality.

Local regression checks: **45 Python tests**, including real CuratorKIT integration and acquisition-integrity tests; **89 application tests**; TypeScript and production build. A cached rerun reproduced all 19 core JSONL files byte for byte. Toolkit event timestamps and top-level run timestamps are intentionally excluded from that comparison. Build emits existing Vinext sourcemap/chunk warnings; they do not prevent completion.

## Files and code map

| Path | Contents |
| --- | --- |
| `data/public_sources.lock.json` | Committed source decisions, revisions, license/format/column contracts and pinned hashes. |
| `data/raw/audit.json`, `downloads.json` | Local preflight/download manifests, URL, bytes and hashes. |
| `data/raw/<source>/<revision>/metadata/` | Original publisher cards and license files. |
| `data/raw/<source>/<revision>/original/` | Immutable downloaded payloads. |
| `data/processed/upi-v1/unified.jsonl` | Accepted masked inputs, eight-field targets, replies and provenance. |
| `data/processed/upi-v1/{train,validation,test}/` | `rlvr.jsonl`, `dpo.jsonl`, `sft.jsonl`, `uncurated_sft.jsonl`, task-shaped `benchmark.jsonl`. |
| `data/processed/upi-v1/manifest.json`, `quality_report.json` | Source/license attribution, source/code/output hashes, distributions, actual stage counts and readiness. |
| `data/processed/upi-v1/source_inspection.json` | Actual per-file counts, columns, labels and format inspection. |
| `data/processed/upi-v1/source_selection_rejected.jsonl`, `rejected.jsonl` | Excluded source rows and gated candidates, with reasons/provenance; no raw private message dump. |
| `data/processed/upi-v1/recovery_pairs.jsonl`, `curatorkit/` | Labelled template preference pairs and real toolkit work files/exports. |
| `data/benchmarks_external/upi-v1/` | Independent benchmark records and manifest; training prohibited. |
| `artifacts/public-data-validation.json`, `public-data-reproducibility.json` | Local verification evidence; not model scores. |
| `research/test_public_data.py` | Offline regression and real toolkit integration tests. |

Originals, processed corpora, benchmarks, toolkit work files and validation artifacts are ignored by Git. Only implementation, tests, documentation and the small source lock are committed. Raw originals and JSONL writers use private file permissions. Public availability does not turn transaction references into unrestricted demonstration data; use synthetic examples in the UI.

## AlignTune readiness

The files are **format-compatible** with the existing RLVR/DR-GRPO, DPO and SFT loaders. `scripts/validate_prepared_data.py` validates that compatibility by calling the existing dataset checks only; it does not instantiate a trainer, download a model or evaluate predictions. The default training guard **blocks this unreviewed corpus**. An explicitly authorized bootstrap smoke run can opt in later using the existing `--allow-bootstrap-data` mechanism and `--data data/processed/upi-v1`; no training was started here.

Remaining work before a defensible model-quality study: independent annotation and bank-policy review; regional-language review of examples and replies; varied reviewed DPO preferences; better semantic/family leakage review; comprehensive PII review for source material; and token-length measurement using the selected tokenizer. Current validation/test data are synthetic and share the rule-template reply author, so they cannot measure independent empathy or compliance accuracy. Public silver labels and rule-consistency checks are not independently verified ground truth. AlignTune training and AuditKIT model benchmarking remain unstarted.
