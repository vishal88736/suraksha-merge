# Local model serving for the website

The website runs **model first, rules fallback**. On each `/api/triage` request:

1. The rules engine always runs. It redacts PII and computes evidence, SLA and a complete rules payload.
2. If `SURAKSHA_MODEL_URL` is set, the redacted message and operator context are sent to the local model server. It builds the exact schema prompt used in training (`research/common.py:prompt_for`), verified equal on all 758 training rows by `research/test_serve_model.py`.
3. The model's raw text is used only if it passes every gate in `lib/model-triage.ts`. Nothing is repaired: a prefix, code fence or misspelled key is a rejection.
   - **Strict JSON**: unique keys, nothing else in the text.
   - **Payload schema**: matches the strict payload schema.
   - **UTR**: must be a labelled anchor in the message.
   - **Amount**: must appear in the message.
   - **Reporting delay**: must match operator context.
   - **Language**: must match the operator's override.
   - **Liability tier**: `PENDING_VERIFICATION` is always allowed. Technical tiers must match the category. Zero, limited, bank-policy and negligence tiers must equal the tier the rules derive from operator-verified context. Transactions from 2027 must stay pending.
   - **Fraud categories**: must include `CONTACT_BANK_PSP`, `CALL_1930` and `REPORT_CYBERCRIME`.
   - **Missing UTR**: requires `REQUEST_UTR`.
   - **Customer reply**: still built from templates, and must pass the no-promise and fraud-rail checks.
4. Otherwise the rules payload is returned, with `audit.model = {status: "fallback", reasons: [...]}`. The UI shows which engine produced the payload, and the rejection reasons.

`/api/health` probes the server. `trained_model_connected` is true only when a verified fine-tuned adapter is loaded. A base model is reported as `fine_tuned: false`.

## Run it

Terminal 1, the model server. It binds to loopback only, NF4 uses about 2.5 GB of GPU memory, and it reuses the cached pinned weights:

```bash
HF_HUB_OFFLINE=1 .venv-training/bin/python scripts/serve_model.py
```

Terminal 2, the website. `.dev.vars` is gitignored:

```bash
printf 'SURAKSHA_MODEL_URL=http://127.0.0.1:8765\nSURAKSHA_MODEL_TIMEOUT_MS=15000\n' > .dev.vars
npm run dev    # http://localhost:5173
```

Optional shared secret: set `SURAKSHA_MODEL_TOKEN` in both the server's environment and `.dev.vars`. Remove `SURAKSHA_MODEL_URL` to return to rules-only mode. Only `http://127.0.0.1`, `localhost` and `[::1]` URLs are accepted. A deployed Cloudflare Worker cannot reach your laptop, so production stays rules-only.

## Serving an adapter later

```bash
.venv-training/bin/python scripts/serve_model.py --adapter checkpoints/schema
```

The server refuses an adapter if:

- its manifest identity (revision, weight hashes or tokenizer) differs from the served base;
- it has no verified optimizer update (`training_outcome.parameters_updated`);
- it is a smoke-test adapter, unless `--allow-smoke-adapter` is passed for a labelled experiment.

## Measured on the RTX 4050 (2026-11-13)

Base Qwen2.5-3B-Instruct @ `aa8e7253…`, NF4, greedy decoding, max 256 new tokens, no adapter:

- Health through the real dev site: `model_reachable: true`, `fine_tuned: false`, `trained_model_connected: false`.
- Four test messages (collect scam, merchant failure, P2P not credited, remote-access scam): each generation took 3.1–4.1 s, and **every one fell back with `not_strict_json`**. This matches the earlier probe, where the base model prefixes `JSON:` and misspells `panic_severity`.

The integration works end to end, but the base model's output is never used. Model output will reach customers only after a fine-tuned adapter produces strict JSON and passes these gates. That adapter still needs human-reviewed data and a real evaluation.

## Load and timeouts

The server generates one request at a time on the GPU.
- `--max-queue` (default 2) is how many requests may wait. Any more get `503 busy` at once.
- `--queue-timeout` (default 15 s) caps how long a request may wait.
- The Worker sends its own time budget in `x-suraksha-deadline-ms`. A request that could not start within that budget is dropped, so the GPU never works for a caller that has given up.
- The Worker treats `503` as a `model_busy` fallback and answers with the rules immediately.
- `SURAKSHA_MODEL_TIMEOUT_MS` is capped at 15 000 ms, below the browser's 20 s request timeout, so the rules fallback always has time to answer.

## Hosted inference (deployed Worker)

A deployed Cloudflare Worker cannot reach a laptop. To use a hosted model server, all three of these are required; otherwise the Worker stays rules-only:
- `SURAKSHA_MODEL_ALLOW_REMOTE=true`;
- an `https://` `SURAKSHA_MODEL_URL`;
- `SURAKSHA_MODEL_TOKEN`, sent as a bearer token and set as a secret, never in code.

`serve_model.py` binds to loopback only. Put it behind a TLS reverse proxy on the GPU host (for example Caddy or nginx with a certificate) and start it with the same `SURAKSHA_MODEL_TOKEN`. Messages are redacted before they leave the Worker, but a hosted endpoint still receives transaction details, so it needs the same data-protection approval as any other processor of customer data.
