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
   - **Customer reply**: built from templates by default. With `SURAKSHA_MODEL_REPLIES=true` the server is also asked for a model-written reply (see below); it is used only if it passes every reply check, otherwise the template is used and the reasons are recorded in `audit.reply`.
4. Otherwise the rules payload is returned, with `audit.model = {status: "fallback", reasons: [...]}`. The UI shows which engine produced the payload, and the rejection reasons.

`/api/health` probes the server. `trained_model_connected` is true only when a verified fine-tuned adapter is loaded. A base model is reported as `fine_tuned: false`.

## Run it

Terminal 1, the model server. It binds to loopback only, NF4 uses about 2.5 GB of GPU memory, and it reuses the cached pinned weights:

```bash
HF_HUB_OFFLINE=1 .venv-training/bin/python scripts/serve_model.py
```

Terminal 2, the website. `.dev.vars` is gitignored:

```bash
printf 'SURAKSHA_MODEL_URL=http://127.0.0.1:8765\nSURAKSHA_MODEL_TIMEOUT_MS=35000\n' > .dev.vars
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
- `--queue-timeout` (default 35 s) caps how long a request may wait.
- The Worker sends its own time budget in `x-suraksha-deadline-ms`. A request that could not start within that budget is dropped, so the GPU never works for a caller that has given up.
- The Worker treats `503` as a `model_busy` fallback and answers with the rules immediately.
- `SURAKSHA_MODEL_TIMEOUT_MS` (default and cap 35 000 ms, which includes writing the reply) stays below the browser's 45 s request timeout, so the rules fallback always has time to answer.

## Hosted inference (deployed Worker)

A deployed Cloudflare Worker cannot reach a laptop. To use a hosted model server, all three of these are required; otherwise the Worker stays rules-only:
- `SURAKSHA_MODEL_ALLOW_REMOTE=true`;
- an `https://` `SURAKSHA_MODEL_URL`;
- `SURAKSHA_MODEL_TOKEN`, sent as a bearer token and set as a secret, never in code.

`serve_model.py` binds to loopback only. Put it behind a TLS reverse proxy on the GPU host (for example Caddy or nginx with a certificate) and start it with the same `SURAKSHA_MODEL_TOKEN`. Messages are redacted before they leave the Worker, but a hosted endpoint still receives transaction details, so it needs the same data-protection approval as any other processor of customer data.

## Model-written replies (experimental, off by default)

`artifacts/reviewed/merged-dual-sft-003` was trained on the reviewed JSON task plus a reply task. Serve it and opt in:

```bash
HF_HUB_OFFLINE=1 .venv-training/bin/python scripts/serve_model.py \
  --model artifacts/reviewed/merged-dual-sft-003
printf 'SURAKSHA_MODEL_URL=http://127.0.0.1:8765\nSURAKSHA_MODEL_TIMEOUT_MS=35000\nSURAKSHA_MODEL_REPLIES=true\n' > .dev.vars
```

Only once the model's payload has passed every gate does the Worker make a second request, `{"task": "reply"}`, within the time left of `SURAKSHA_MODEL_TIMEOUT_MS` (`--max-reply-tokens`, default 384). A payload the gates reject therefore costs no reply generation. `validateModelReply` in `lib/model-triage.ts` then rejects a reply that:

- is too short or too long, or promises a refund or outcome;
- misses the fraud rails (bank/PSP, 1930, cybercrime.gov.in) for a fraud category;
- is not in the reply language the rules chose;
- mentions a UTR, amount, link or phone number that isn't in the message or policy;
- contradicts the category (T+1/T+5 timelines outside technical failures, wrong-beneficiary advice outside wrong-VPA cases).

A rejected reply is replaced by the template, and the UI tags each reply "written by the model" or "template" with the reasons.

**Measured quality (live, `scripts/eval-replies.ts`, `artifacts/reviewed/eval/replies-003.txt`):**

| Set | Category / fields correct | Model reply passed checks | Main rejection reasons |
| :--- | ---: | ---: | :--- |
| 54 reviewed test cases | 90.7% all fields | 27 of 52 | missing fraud rails 16, unknown link 5 |
| 42 challenge cases | 73.8% category | 16 of 39 | wrong language 14, missing fraud rails 14 |

What a user would see, from six fresh messages sent to the running site with replies on: the model's JSON was accepted for one, so only one reply could come from the model, and every request took about 10 s instead of 2–3 s because the reply was written before the gates ran. The reply is now asked for only after the payload is accepted: on the same six messages, the five rejected payloads took 2.4–3.9 s and the accepted one 7.1 s including its reply. That one reply was the Hinglish template copied back nearly word for word, with two new errors ("tabhi compensation ya liability verification karega", "bhi sakte hai"). The reply targets in training were the templates themselves, so this is what the model learned; a genuinely better model reply would need human-written reply examples, which the project doesn't have.

Reading the raw replies on the evaluation sets showed garbled Hindi, Hindi answers to English messages and some wrong advice, which is why this stays off by default. The dual model is also less accurate on the JSON task than `merged-schema-sft-002` (90.7% vs 96.3% on the reviewed test), so the schema-only model (now `merged-schema-sft-004`) with template replies remains the recommended setup. The checks catch the failure classes above; they cannot prove a reply that passes is good advice, so no model reply has been human-reviewed for quality.

