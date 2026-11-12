# Review and AlignTune preparation

Implementation executed on 12 November 2026. No model has been trained or evaluated. The original 934-case corpus and CuratorKIT outputs are preserved. Review data and smoke outputs are local, private JSONL files ignored by Git.

## Current evidence

- Annotation queue: 934 pending cases, all seven categories and five languages; zero human-reviewed and zero human-rejected cases.
- Evaluation: 92 pending candidates from the existing held-out synthetic test split. They cover all seven categories and five languages. Training and model selection must exclude these scenario families.
- Family isolation and normalized character-trigram near-duplicate checks (Jaccard 0.85) passed across original splits. These checks do not establish semantic independence or empirical generalization.
- Qwen metadata revision: `aa8e72537993ba99e69dfaafa59ed015b17504d1`, pinned with hashes in `research/qwen_model.lock.json`.
- Actual tokenizer runtime 0.22.2: 934 schema examples measured. Maximum schema prompt 976 tokens; maximum answer 136; maximum combined schema sequence 1,107; maximum raw SFT/DPO sequence 1,614. None exceed configured raw limits (schema prompt 1,536, completion 512, combined/SFT 2,048). Trainer chat-template expansion is still unverified.
- Published tokenizer maximum ID 151,664 fits the configured 151,936 embedding rows. Padding above tokenizer vocabulary is valid. Actual input/output weight tensors have not been loaded.
- `nvidia-smi` currently detects an RTX 4050 Laptop GPU with 6,141 MiB total VRAM (5,851 MiB free during the probe). PyTorch, Transformers, AlignTune, PEFT, TRL, Accelerate and safetensors are not installed in the current curation environment.
- CUDA via PyTorch, live AlignTune factory/reward registration, actual embeddings and real training/checkpoint saving: **BLOCKED**. Driver visibility alone does not establish CUDA training readiness.
- Planning estimates for unquantized bf16 LoRA: 5.76 GiB base weights alone; approximately 24–48 GiB for DR-GRPO and 16–32 GiB for DPO, depending on activations, generation/reference storage and optimizer implementation. These are estimates, not measured peaks. This 6 GB GPU is unsuitable for the current configuration. Quantization/offloading are not configured or validated.

## Human review CLI

From the repository root:

```bash
.venv/bin/python scripts/prepare_review.py build
.venv/bin/python scripts/prepare_review.py evaluation
.venv/bin/python scripts/prepare_review.py export --output data/review/status
```

`data/review/annotation_queue.jsonl` contains all complaint text, operator input, expected eight-field JSON, both DPO replies, source provenance, origin, family, split, priority and pending status. Fraud, conditional liability, numeric facts, incomplete evidence and public silver labels raise priority. Category and language coverage are checked. The queue stays immutable; decisions and materialized status are stored separately. Rerunning an unchanged build is safe; a changed corpus requires a new queue path/version.

Use a real review ID from that file. Display a case and its current history:

```bash
.venv/bin/python scripts/prepare_review.py show REVIEW_ID
```

A human reviewer must verify classification, every JSON field against the complaint/operator evidence, regional-language quality, applicable RBI guidance and the chosen/rejected preference. Do not infer liability from elapsed transaction age, trust source assistant claims or promise an approved refund. Pattern/schema checks assist review; they cannot certify policy or language correctness.

Only after a person completes all five dimensions:

```bash
.venv/bin/python scripts/prepare_review.py decide REVIEW_ID \
  --reviewer 'REAL_REVIEWER_ID' --action accept --attest-human-review \
  --confirmed-fields classification json_ground_truth language_quality rbi_policy_guidance dpo_preference \
  --notes 'Evidence checked; policy references and regional wording reviewed.'
```

Reject or reopen using the same identity and attestation flags with `--action reject` or `--action reopen`. Reopening restores pending status. To correct, create a JSON file containing only the fields to change: `expected_json` (the complete eight-field object), `chosen_reply`, and/or `rejected_reply`. Then run:

```bash
.venv/bin/python scripts/prepare_review.py decide REVIEW_ID \
  --reviewer 'REAL_REVIEWER_ID' --action correct --corrections /path/to/correction.json \
  --attest-human-review \
  --confirmed-fields classification json_ground_truth language_quality rbi_policy_guidance dpo_preference
.venv/bin/python scripts/prepare_review.py export --output data/review/status
```

Corrections cannot set provenance, human status or complaint text. Schema, grounded UTR, chosen-reply policy patterns, required fraud rails and distinct preference replies are checked. Materialized `reviewed.jsonl`, `rejected.jsonl` and `unreviewed.jsonl` retain immutable source provenance plus full history. Decisions record reviewer, UTC timestamp, item hash, prior decision hash, corrections and notes. Writes are atomic and locked against concurrent lost updates. Later acceptance retains earlier corrections. Changing queue content or history invalidates verification.

Reviewer IDs and attestations are local human assertions, not authenticated identity or a digital-signature system. No script infers human review from generated content. No real decisions were created during implementation; test decisions use temporary fixture records only.

## Evaluation gate

Candidates and a manifest live under `data/review/evaluation/`. The original external IndicJevBench/Chakravyuh benchmark remains separate. This new set is the existing test split prepared for independent human review; it is not newly collected empirical gold.

Use the same `show`/`decide` commands with:

```text
--queue data/review/evaluation/candidates.jsonl
--decisions data/review/evaluation/decisions.jsonl
```

Assign an evaluation reviewer independent of anyone who reviewed the same annotation. To finalize after review:

```bash
.venv/bin/python scripts/prepare_review.py finalize-evaluation \
  --queue data/review/evaluation/candidates.jsonl \
  --decisions data/review/evaluation/decisions.jsonl \
  --annotation-decisions data/review/decisions.jsonl \
  --output data/review/evaluation/release-v1
```

Pending cases, missing category/language coverage or a shared annotation/evaluation reviewer for a case block release. Rejected cases stay separate. Do not pass pending candidates to a model benchmark. Any later annotation changes require another reviewed release.

## Reviewed training promotion

After actual review, export reviewed train/validation inputs, excluding held-out test cases:

```bash
.venv/bin/python scripts/prepare_review.py export-curation \
  --output data/review/reviewed_curation_inputs.jsonl
.venv/bin/python phase1_curatorkit_pipeline.py \
  --input data/review/reviewed_curation_inputs.jsonl \
  --output data/processed/upi-reviewed-v1 --use-curatorkit
```

The exporter requires reviewed train and validation data and all category/language coverage. Existing phase-one gates remain active: corrected human targets that disagree with the rule engine are quarantined for investigation, never silently relabelled to engine predictions. Inspect every rejection and the resulting manifest. Regional-language review and bank-policy approval remain human dependencies. The original corpus stays unchanged.

## Environment checks

CPU-only tokenizer inspection:

```bash
uv pip install --python .venv/bin/python -r requirements-training-checks.txt
.venv/bin/python scripts/check_training_environment.py --fetch-tokenizer
```

This fetches only pinned configuration/tokenizer files and verifies hashes. Report: `artifacts/training-preflight/environment.json`. Reuse the cache without `--fetch-tokenizer`. It checks published vocabulary bounds, raw schema/SFT/DPO token lengths, static shared LoRA parameters and installed packages, and probes the driver/CUDA independently. Reports use PASSED, FAILED (an actual mismatch), BLOCKED (unavailable dependency/access/runtime) and ESTIMATE_ONLY.

On a suitable Linux CUDA training host, install a CUDA-compatible PyTorch build following its official installation selector, then install the pinned AlignTune environment separately:

```bash
uv venv --python 3.12 .venv-training
uv pip install --python .venv-training/bin/python -r requirements-training.txt
.venv-training/bin/python scripts/check_training_environment.py --fetch-tokenizer
uv pip check --python .venv-training/bin/python
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv
```

The report checks the installed AlignTune Git revision against `research/toolkit_revisions.json` and its real factory import/signature. Runtime trainer compatibility remains subject to the smoke run. No full training dependencies were installed on this local 6 GB host.

To inspect actual embeddings, provide an already downloaded complete local Qwen snapshot (weights plus tokenizer/config) explicitly:

```bash
.venv-training/bin/python scripts/check_training_environment.py \
  --model-dir /path/to/pinned/qwen-snapshot --load-local-weights
```

This can use substantial CPU RAM. Metadata inspection does not load weights. Both specialists must use the exact same base revision, vocabulary/token IDs, rank 32, alpha 64 and seven target modules. Their identities and weight/config hashes are recorded and compared before merging. The default vocabulary remains unchanged.

## Isolated smoke procedure

Local executable checks:

```bash
.venv/bin/python scripts/prepare_smoke_data.py
.venv/bin/python scripts/verify_training_smoke.py
.venv/bin/python -m unittest discover -s research -p 'test_*.py' -v
```

Two bundled synthetic fixtures are curated through actual CuratorKIT into `artifacts/smoke-test/data`. No public or operational records are used. The CPU preflight verifies hashes, loading, reward outputs, preference formatting and one-step configuration. Unit tests mock the AlignTune registry/factory to check registration, DR-GRPO/DPO configuration, shared LoRA parameters, checkpoint presence, manifest writing and tamper rejection. Mock artifacts are temporary fixture bytes, not trained weights.

Only on a suitable host with the training dependencies installed, run actual one-step smoke training:

```bash
.venv-training/bin/python phase2_aligntune_train_and_merge.py --stage schema \
  --revision aa8e72537993ba99e69dfaafa59ed015b17504d1 \
  --data artifacts/smoke-test/data --output artifacts/smoke-test/run-001 \
  --allow-bootstrap-data --smoke-test --max-steps 1
.venv-training/bin/python phase2_aligntune_train_and_merge.py --stage empathy \
  --revision aa8e72537993ba99e69dfaafa59ed015b17504d1 \
  --data artifacts/smoke-test/data --output artifacts/smoke-test/run-001 \
  --allow-bootstrap-data --smoke-test --max-steps 1
```

Use a fresh output for each run. Both commands require a working CUDA runtime by default. The bootstrap override permits only a dedicated synthetic-only dataset of at most two cases, exactly one step, explicit smoke mode and output under `artifacts/smoke-test`. Tokenizer adaptation and merging cannot use this override; smoke adapters cannot be merged as final artifacts. Saved real adapters require actual config/weight files and hashed manifests. CPU fixtures do not establish actual trainer execution, real checkpoint creation or inference quality.

## Before full specialist training

1. Complete named human annotation and policy/language/preference review; export reviewed train/validation data and investigate all curation rejections.
2. Independently review and freeze evaluation candidates; keep their families out of training and selection.
3. Use a suitable GPU host, install pinned AlignTune and compatible CUDA dependencies, and pass package/factory checks.
4. Verify actual local embeddings, final trainer chat-template lengths, shared base/tokenizer identity and measured free GPU memory.
5. Run both real one-step smoke commands, verify real adapter hashes/manifests and perform separately recorded smoke inference. These runtime steps remain blocked here.
6. Start `--stage schema` (DR-GRPO) and `--stage empathy` (DPO) with `--data data/processed/upi-reviewed-v1`, the same immutable base revision and a fresh checkpoint output; omit both bootstrap/smoke flags. Inspect the default review guard and dataset hashes before launching.

No real checkpoint, inference result, model accuracy, empathy score or measured training-memory peak is claimed by this implementation.
