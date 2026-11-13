# RTX 4050 NF4 smoke profile

This experimental profile was added after CUDA and bitsandbytes NF4 execution passed on the user's RTX 4050 laptop. It enables actual training commands for a one-step allocation/adapter-saving experiment. Whether Qwen 3B fits remains unverified until that step executes; configuration checks do not establish memory fit or model quality.

The `laptop-6gb` profile uses the existing AlignTune TRL backend with NF4 double quantization, bf16 compute when supported, rank 8 / alpha 16 LoRA on q_proj and v_proj, gradient checkpointing, SDPA attention, an 8-bit AdamW optimizer, batch 1 and accumulation 2. Sequence budget is 1,280; schema uses two generations and at most 256 generated tokens. Schema KL beta is zero for this smoke experiment. DPO keeps beta 0.1 and uses the base with adapters disabled as its reference, following the pinned backend's PEFT path. No second reference model or vLLM server is requested. These are experimental smoke settings, not selected full-training hyperparameters.

The profile requires the existing two-case synthetic fixture dataset, `--smoke-test`, `--allow-bootstrap-data` and exactly one step. Outputs must stay under `artifacts/smoke-test`. It cannot train on the full unreviewed corpus or merge smoke adapters into final deployment artifacts. The default reviewed-data training configuration remains unchanged.

From the repository root, using the already installed training environment:

```bash
.venv/bin/python scripts/prepare_smoke_data.py

# Factory/config/reward check only: no model weights or optimizer steps.
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage schema --profile laptop-6gb --check-config \
  --data artifacts/smoke-test/data --output artifacts/smoke-test/nf4-check \
  --smoke-test --allow-bootstrap-data --max-steps 1

.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage empathy --profile laptop-6gb --check-config \
  --data artifacts/smoke-test/data --output artifacts/smoke-test/nf4-check \
  --smoke-test --allow-bootstrap-data --max-steps 1
```

Both configuration checks were actually executed against pinned AlignTune `9a80753f2f0af7c5d9b1246904035e9149ea30e1`. They instantiated TRLDRGRPOTrainer/TRLDPOTrainer configuration without loading model weights. The schema check also instantiated the actual registered reward and its TRL callback, scoring the known exact JSON fixture as 1.0. This is a reward-plumbing fixture result, not a model score. The Python regression suite passed 62 tests, including shared NF4 settings and smoke-only restrictions.

To attempt an actual schema smoke step (downloads the pinned base weights on first use):

```bash
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage schema --profile laptop-6gb \
  --revision aa8e72537993ba99e69dfaafa59ed015b17504d1 \
  --data artifacts/smoke-test/data \
  --output artifacts/smoke-test/laptop-nf4-001 \
  --smoke-test --allow-bootstrap-data --max-steps 1
```

After schema completes successfully, attempt the DPO step:

```bash
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage empathy --profile laptop-6gb \
  --revision aa8e72537993ba99e69dfaafa59ed015b17504d1 \
  --data artifacts/smoke-test/data \
  --output artifacts/smoke-test/laptop-nf4-001 \
  --smoke-test --allow-bootstrap-data --max-steps 1
```

Use a new run directory for retries after any saved checkpoint. If GPU memory runs out, the script reports an incomplete run in `oom_report.json`; no successful adapter manifest is fabricated. Do not automatically fall back to CPU or silently change the model. Close other GPU workloads, or use a smaller base / larger GPU in a separately labelled experiment. A successful step verifies only that this tiny setup runs and saves an adapter on that host. It does not establish that longer real training or all regional examples fit.

Successful real smoke manifests record the actual shared rank/alpha/modules, NF4 settings and peak CUDA allocated/reserved bytes. The existing checkpoint hash safeguards remain active. No real optimizer step or model evaluation was run during implementation of this profile. Human review remains required before full training.

## Transformers 5 revision compatibility

The identity check resolves and pins the public Hub revision before loading configuration or tokenizer. An explicit 40-character commit is retained directly; floating branches/tags are resolved to a commit through `HfApi.model_info`. It no longer depends on `config._commit_hash`, which is absent in the installed Transformers 5 version. The explicit Qwen revision was verified offline with the actual cached config/tokenizer (151,665 tokenizer entries). No weight loading or training was involved in that check.

If a previous run stopped at the identity check, reuse its output directory because no checkpoint was created. Cached completed downloads are reused. For slow downloads, prefix the training command with `HF_HUB_DOWNLOAD_TIMEOUT=120 HF_HUB_ETAG_TIMEOUT=60`. Do not set `HF_HUB_OFFLINE=1` for the training retry unless all model weights are already cached.

## Measured RTX 4050 results (2026-11-13)

All runs: Qwen2.5-3B-Instruct @ `aa8e7253…`, NF4 + double quant, bf16 compute, LoRA r8/α16 on q/v, two synthetic smoke fixtures, one step. Logs: `artifacts/laptop-nf4-00{2,3}-*.log`.

| Run | Stage | Outcome | Peak CUDA allocated / reserved |
|---|---|---|---|
| `laptop-nf4-001` | schema (raw-string prompts) | Step executed; **no update** (both completions hit 256-token cap, reward −1/−1, grad_norm 0, all LoRA-B zero) | 4.29 GB / 4.64 GB |
| `laptop-nf4-002` | schema (chat-formatted) | Step executed; completions now terminate (136–151 tokens, clipped 0%) but still reward −1/−1 → zero GRPO advantage → **no update**; script exits non-zero | 4.01 GB / 4.18 GB |
| `laptop-nf4-002` | empathy (DPO) | **OOM** in policy forward (1.39 GiB full-vocab logits) | 4.86 GB / 5.41 GB |
| `laptop-nf4-003` | empathy (DPO, precomputed reference log-probs) | Reference precompute succeeded; **OOM** in policy forward (needs 1.39 GiB, 1.07 GiB free) | 4.94 GB / 5.51 GB |

What this establishes: NF4 Qwen 3B loads, generates GRPO rollouts, scores them with the real reward, runs the GRPO trainer step and saves an adapter within ~4.2 GB on this GPU. It does **not** establish an applied optimizer update for either stage, and DPO at these sequence lengths (~1,229 tokens per side) does not fit in 6 GB.

### Fixes from these runs

- **Chat template** (all profiles): inference (`scripts/generate_predictions.py`) renders prompts through the tokenizer chat template; training previously fed raw strings, so the instruct model never saw an assistant turn. RLVR prompts are now user-message lists (AlignTune preserves them and TRL applies the template). DPO prompts are rendered with the pinned tokenizer, because AlignTune's DPO loader flattens message lists; TRL appends `eos_token` (`<|im_end|>`) to chosen/rejected, matching the template's assistant turn. Prepared files and hashes go to `<output>/<stage>/prepared/` and `training_data` in the manifest.
- **Physical weight hashes for Hub bases**: `identity.base_weights` was `{}` for Hub models. It now records SHA-256 for each materialized shard (these equal the Hub LFS pointers). Merge re-hashes and compares.
- **Applied-update check**: LoRA B is zero-initialized, so an all-zero B after training proves no optimizer update. The manifest records `training_outcome` (trainer metrics, `parameters_updated`), and the script exits non-zero when nothing changed. Merge requires `parameters_updated: true` for both adapters.
- **DPO memory (laptop profile)**: `precompute_ref_log_probs` with batch size 1 and `keep_columns=True`. TRL reads cached log-probs from a fingerprinted file that exists only for disk-backed datasets; in-memory datasets get a random filename. Also `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`.

### Open blockers (decisions, not bugs)

- **Schema GRPO cold start**: the base model writes near-valid triage JSON but prefixes `JSON:` and misspells `panic_severity`. The strict reward gives −1 to every failure, so a 2-sample group always ties. Options: SFT warm-start before GRPO, more generations per prompt (more memory), or partial credit in the reward (changes the reward contract). The reward was intentionally left unchanged.
- **DPO on 6 GB**: TRL 1.7.1 DPO has no `logits_to_keep`, and its Liger fused loss is not implemented for PEFT models. Remaining options: a larger GPU, shorter smoke fixtures (proves plumbing only; real corpus pairs reach ~1,645 tokens), or a smaller base in a separately labelled experiment.
