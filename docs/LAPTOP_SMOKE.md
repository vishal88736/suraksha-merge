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
