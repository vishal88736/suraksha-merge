# Unreviewed pilot: CuratorKIT → AlignTune → AuditKIT on an RTX 4050

**Status:** an explicitly labelled research pilot on the *unreviewed synthetic* corpus. The corpus has 0 human-reviewed cases, and the test set is synthetic and from the same distribution. These numbers are **not** a model-quality claim: the report sets `model_quality_claim_permitted: false` and `benchmark_human_reviewed: false`. Pilot adapters can't be promoted. `scripts/merge_pilot_adapter.py` merges one only into a pilot base under `artifacts/pilot` (a GRPO warm start and a faster pilot server), and that merge is still labelled a pilot. They can be served only with `--allow-pilot-adapter`, and are then labelled as a pilot in the UI and `/api/health` (`trained_model_connected` stays false). Real training still requires human review (docs/HUMAN_REVIEW_AND_TRAINING.md).

## Pipeline

1. **CuratorKIT**: `data/processed/upi-v1/` (934 cases; 758 train / 84 validation / 92 test), built with the real CuratorKIT (docs/DATA_CURATION.md).
2. **AlignTune, QLoRA SFT on the schema task**:
   - Data: 758 `train/rlvr.jsonl` prompt → JSON answer pairs.
   - Prompt format: AlignTune builds user/assistant messages, and TRL renders them with Qwen's chat template. This is byte-identical to inference for all rows.
   - Loss: `assistant_only_loss` trains only the answer plus `<|im_end|>` (verified on all rows), and `chunked_nll` avoids full-vocabulary logits.
   - Model and optimizer: NF4 base with double quantization, bf16 compute, LoRA r16/α32 on q/k/v/o/gate/up/down, learning rate 1e-4 cosine, 8-bit AdamW.
   - Batch: 1 × gradient accumulation 8, max length 1,280 (longest example: 1,124 tokens).
3. **AuditKIT**: `phase3_auditkit_eval.py --auditkit` on the 92 test cases. Base and pilot are generated identically: NF4, greedy decoding, 512 max new tokens, two calls per case. Repairs are disabled.

```bash
# train (≈27 min on the RTX 4050)
HF_HUB_OFFLINE=1 .venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage curated-sft --profile laptop-6gb --unreviewed-pilot --allow-bootstrap-data \
  --revision aa8e72537993ba99e69dfaafa59ed015b17504d1 \
  --data data/processed/upi-v1 --output artifacts/pilot/schema-sft-001 --max-steps 95

# predictions (≈12 min base, ≈20 min pilot)
for args in "--output artifacts/pilot/eval/base.jsonl" \
            "--adapter artifacts/pilot/schema-sft-001/curated-sft --allow-pilot-adapter --output artifacts/pilot/eval/pilot-schema-sft.jsonl"; do
  HF_HUB_OFFLINE=1 .venv-training/bin/python scripts/generate_predictions.py \
    --model Qwen/Qwen2.5-3B-Instruct --revision aa8e72537993ba99e69dfaafa59ed015b17504d1 \
    --quantization nf4 --max-new-tokens 512 --benchmark data/processed/upi-v1/test/benchmark.jsonl $args
done

# evaluation (AuditKIT lives in .venv)
.venv/bin/python phase3_auditkit_eval.py --benchmark data/processed/upi-v1/test/benchmark.jsonl \
  --predictions base=artifacts/pilot/eval/base.jsonl \
  --predictions curated-sft=artifacts/pilot/eval/pilot-schema-sft.jsonl \
  --baseline base --auditkit --output artifacts/pilot/eval/evaluation.json
```

## Measured (2026-11-13)

Training: 95 optimizer steps (one epoch), `parameters_updated: true`, peak CUDA 4.09 GB allocated / 4.24 GB reserved. Training loss 0.32 → 0.004 and token accuracy 0.917 → 0.999. These numbers show training-set fit on formulaic synthetic data, not quality.

Held-out synthetic test set (92 cases, 10 scenario groups):

| Metric | Base Qwen2.5-3B | Pilot schema SFT |
|---|---|---|
| Strict schema pass | 0.000 | 1.000 |
| All 8 fields exact | 0.000 | 0.728 |
| Per-field exact match | 0 | 0.959 |
| UTR + liability tier exact | 0.000 | 0.837 |
| Unauthorized-guarantee pattern rate | 0.000 | 0.000 |
| Required fraud rails (reply) | 0.609 | 0.826 |
| chrF vs reference reply | 13.8 | 19.7 |
| Utility | 0.000 | 0.857 |
| Mean latency per case (2 calls) | 8.0 s | 13.2 s |

- **Paired bootstrap (utility, pilot − base):** +0.857, 95% CI [0.772, 0.933], resampled by scenario group.
- **AuditKIT 1.1.6:** the schema, all-fields and unsafe-guarantee metrics equal the local scorer exactly for both runs, and the two runs have distinct fingerprints. The evaluator now refuses to report an AuditKIT result that disagrees.
- **Pilot errors:** liability tier wrong in 15/92 cases, mandatory actions in 10, panic severity in 5. UTR, amount, category, language and reporting delay were exact in every case.

### Caveats

- The test set comes from the same synthetic generators as the training set, so these results measure fit to that distribution, not real customer messages.
- The adapter was trained only on the schema task. The reply metrics come from the same adapter applied to the reply prompt; empathy is not evaluated by humans.
- The liability tier is policy reasoning. The website still accepts a model tier only if it matches the tier derived from verified operator context.

### AuditKIT stale-cache bug found during this run

The first evaluation reported AuditKIT schema = 1.0 for the base model, while the local scorer measured 0.0. AuditKIT fingerprints a callable model by its code and immutable captures. The prediction dict is mutable, so it isn't captured, and all runs hashed to one fingerprint: the earlier fixture run (perfect predictions) was replayed. `auditkit_evaluate` now binds the predictions' SHA-256 into the callable, records the fingerprint, and raises if AuditKIT's means differ from the local scorer's. Regression test: `research/test_auditkit_eval.py`.

## Round 2: dual SFT, merge, pilot GRPO (2026-11-13)

All the runs below are still unreviewed pilots on the same synthetic data. Generation and scoring were the same as above. Full report: `artifacts/pilot/eval/evaluation-all.json`. AuditKIT matched the local scorer on every run.

```bash
# dual SFT (JSON + ---REPLY--- + reply): 190 steps, peak 4.47 GB, loss 2.36 → 0.012
... phase2_aligntune_train_and_merge.py --stage curated-sft --profile laptop-6gb --unreviewed-pilot \
    --pilot-task dual --allow-bootstrap-data --data data/processed/upi-v1 --output artifacts/pilot/dual-sft-001
# CPU bf16 merge of the schema adapter (AlignTune PEFTMerger)
.venv-training/bin/python scripts/merge_pilot_adapter.py \
    --adapter artifacts/pilot/schema-sft-001/curated-sft --output artifacts/pilot/merged-schema-sft-001
# pilot schema GRPO from the merged base: 150 steps, ≈22 s/step, peak 4.17 GB
... phase2_aligntune_train_and_merge.py --stage schema --profile laptop-6gb --unreviewed-pilot \
    --shared-base artifacts/pilot/merged-schema-sft-001 --allow-bootstrap-data \
    --data data/processed/upi-v1 --output artifacts/pilot/grpo-001 --max-steps 150
```

| Metric | Base | Schema SFT (adapter) | Schema SFT (merged) | Schema SFT → GRPO | Dual SFT |
|---|---|---|---|---|---|
| Strict schema pass | 0.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| All 8 fields exact | 0.000 | 0.728 | 0.707 | 0.750 | 0.739 |
| Per-field exact | 0 | 0.959 | 0.957 | 0.962 | 0.947 |
| UTR + tier exact | 0.000 | 0.837 | 0.837 | 0.837 | 0.804 |
| Guarantee-pattern rate | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| Fraud rails (reply) | 0.609 | 0.826 | 0.880 | 0.859 | 1.000 |
| chrF vs reference reply | 13.8 | 19.7 | 18.9 | 19.1 | 92.9 |
| Utility | 0.000 | 0.857 | 0.859 | 0.872 | 0.896 |
| Latency per case (2 calls) | 8.0 s | 13.2 s | 8.1 s | 14.3 s | 19.4 s |

Field errors out of 92 cases:

| Model | Tier | Actions | Panic | Category | Delay |
|---|---|---|---|---|---|
| Schema SFT (adapter) | 15 | 10 | 5 | 0 | 0 |
| Schema SFT (merged) | 15 | 11 | 5 | 1 | 0 |
| Schema SFT → GRPO | 15 | 10 | 3 | 0 | 0 |
| Dual SFT | 18 | 11 | 2 | 3 | 5 |

Paired bootstrap of utility deltas, 95% CI resampled over the 10 scenario groups:

- Every pilot beats the base model. Lower bounds are 0.76 to 0.83.
- The pilots are not separable from each other:
  - adapter → merged: +0.002, CI [−0.031, 0.037]
  - merged → GRPO: +0.013, CI [−0.002, 0.028]
  - schema → dual: +0.039, CI [−0.017, 0.086]

Reading:

- **Merging changes nothing measurable but cuts latency by about 40%** (13.2 s → 8.1 s, the same as the base model), because it removes the LoRA overhead under NF4. The single changed category comes from bf16→NF4 re-quantization. For local serving, a merged pilot is the practical option.
- **GRPO** made a small, non-significant improvement in panic severity and all-fields exact. It did not fix the liability tier, the dominant error. Its training reward was noisy and drifted down (first 30 steps mean 0.898, last 30 steps 0.775). It runs as an adapter over the merged base, so it pays the adapter latency again.
- **Dual SFT's chrF of 92.9 is template memorisation, not empathy.** The reference replies are deterministic templates from `lib/i18n/replies.ts`. Its fraud rails reached 1.0, but its JSON got slightly worse (tier, delay, category).
- **Liability tier (15–18/92) is the remaining hard field** for every model. The website accepts a model tier only when it matches the tier derived from verified operator context.

## Round 3: pilot DPO (step 4) and schema + empathy merge (step 5) (2026-11-14)

### Making DPO fit in 6 GB

TRL 1.7.1's DPO loss materialised full-vocabulary logits over the whole sequence, which caused the earlier out-of-memory error. Each sequence is a ~1,000-token prompt plus both replies. `research/dpo_completion_logits.py` patches `trl.DPOTrainer` in-process, and phase 2 installs it only for the laptop DPO stage:

- **Logits only for the reply window.** The model is called with `logits_to_keep` covering the window from the first reply token, and labels and masks are sliced to match. This is the same objective. The reference log-probs are tested equal to TRL's own full-logits computation (`research/test_dpo_completion_logits.py`).
- **fp32 log-probs.** The window logits are upcast before log-softmax. Plain bf16 sums lose several nats at |logp| ≈ 1,000, which would swamp the DPO signal.
- **Frozen weights stay in bf16.** `peft.prepare_model_for_kbit_training` upcasts frozen non-quantized weights (the tied embedding/head and the norms) to fp32. The patch keeps them in their loaded bf16 (182 tensors), while trainable LoRA weights stay fp32.

Measured on the longest pair (1,622 tokens), the step peak went from 5.62 GB to 4.82 GB. The first attempt, with only the logits window, still ran out of memory: 5.44 GB allocated, `artifacts/pilot/dpo-001-oom.log`.

```bash
HF_HUB_OFFLINE=1 .venv-training/bin/python phase2_aligntune_train_and_merge.py --stage empathy --profile laptop-6gb \
  --unreviewed-pilot --allow-bootstrap-data --revision aa8e72537993ba99e69dfaafa59ed015b17504d1 \
  --data data/processed/upi-v1 --output artifacts/pilot/dpo-001 --max-steps 190
.venv-training/bin/python scripts/merge_pilot_adapter.py --adapter artifacts/pilot/schema-sft-001/curated-sft \
  --empathy-adapter artifacts/pilot/dpo-001/empathy --schema-weight 0.55 --output artifacts/pilot/merged-schema-empathy-001
```

### DPO run settings and training metrics

The pilot DPO run used the original pinned base, with LoRA r16/α32 on all seven projection modules. This is the same LoRA shape as the schema SFT pilot, so the two adapters can be combined. Other settings:

- β 0.1, learning rate 2e-5, gradient accumulation 4, max length 1,664
- 758 pairs, 190 steps
- reference log-probs precomputed (26 min), training 52 min
- peak 4.72 GB, `parameters_updated: true`

**The run saturated almost immediately.** By step 35, loss was about 1e-6, reward accuracy 1.0 and the margin about 14. Every rejected reply in `train/dpo.jsonl` is the same one-line guarantee ("Your refund is 100% guaranteed…", ≤52 tokens). The pairs are trivially separable, and because a DPO gradient scales with the loss, the remaining ~155 steps taught almost nothing.

### Results (92 synthetic test cases; full report `artifacts/pilot/eval/evaluation-all.json`)

| Metric | Base | Schema SFT | DPO adapter | Schema + empathy merge (0.55/0.45) |
|---|---|---|---|---|
| Strict schema pass | 0.000 | 1.000 | 0.000 | 0.989 |
| All 8 fields exact | 0.000 | 0.728 | 0.000 | **0.000** |
| Per-field exact | 0 | 0.959 | 0 | 0.773 |
| UTR + tier exact | 0.000 | 0.837 | 0.000 | 0.652 |
| Guarantee-pattern rate | 0.000 | 0.000 | 0.000 | **0.011** (1 case) |
| Fraud rails (reply) | 0.609 | 0.826 | 0.609 | 0.859 |
| chrF vs reference reply | 13.8 | 19.7 | 20.3 | 20.1 |
| Utility | 0.000 | 0.857 | 0.000 | 0.563 |
| Latency per case | 8.0 s | 13.2 s | 17.9 s | 9.0 s |

- **The DPO adapter changes the wording of every reply but not its substance.** chrF rose only from 13.8 to 20.3, and fraud rails are unchanged. Its JSON is still the base model's `JSON:`-prefixed output, which is expected because it was trained only on replies.
- **The step 5 merge is significantly worse than schema SFT:** utility −0.293, 95% CI [−0.368, −0.204]. Mandatory actions are wrong in 83/92 cases, panic severity in 36 and the tier in 31. The convex 0.55/0.45 weighting scales the schema update down to 55%, which undoes much of it. One reply matched the unauthorized-guarantee pattern.
- **Conclusion for the real pipeline:**
  - Before reviewed training, the DPO data needs harder rejected replies: policy-violating but fluent, case-specific replies. A single canned sentence is not enough.
  - The merge weights need re-selecting on a validation split, for example full-strength task vectors. The current default is 0.55/0.45.
  - Neither pilot model should be served. The best pilot for serving is still `merged-schema-sft-001`.

## Still not possible

- **Real-message evaluation (step 8)** needs real, human-reviewed messages; there are none.

## AI pre-screen of the review queue

`node scripts/prescreen-review.ts` writes `data/review/ai_prescreen.jsonl` with `is_human_review: false`. It records no review decisions. Results over the 934 items:

- 535: no flag
- 259: low (`public_source_case`)
- 140: medium, `reply_script_mismatch`. All 140 are `marathi_english` cases where the customer writes in Latin script but the reply template is Devanagari.

The rules engine agrees with every label. That is expected, because the labels were generated by the engine, so this is no evidence that the labels are correct. The script choice for Marathi-English replies is a product decision still open; reviewers should defer those 140 cases until it is made.
