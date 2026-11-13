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

## Not runnable on this laptop

- **DPO empathy (step 4)** runs out of memory on 6 GB even with precomputed reference log-probs: full-vocabulary logits need 1.39 GiB, and Liger DPO does not support PEFT. It needs a 16–24 GB GPU.
- **Schema + empathy merge (step 5)** depends on step 4.
- **Real-message evaluation (step 8)** needs real, human-reviewed messages.

## AI pre-screen of the review queue

`node scripts/prescreen-review.ts` writes `data/review/ai_prescreen.jsonl` with `is_human_review: false`. It records no review decisions. Results over the 934 items:

- 535: no flag
- 259: low (`public_source_case`)
- 140: medium, `reply_script_mismatch`. All 140 are `marathi_english` cases where the customer writes in Latin script but the reply template is Devanagari.

The rules engine agrees with every label. That is expected, because the labels were generated by the engine, so this is no evidence that the labels are correct. The script choice for Marathi-English replies is a product decision still open; reviewers should defer those 140 cases until it is made.
