# Local model serving for the website

The website can run in three ways. Which one you get depends only on `.dev.vars` (or the Worker's environment):

| Mode | When | Who writes the answer |
| :--- | :--- | :--- |
| **Model authority** (default with a model) | `SURAKSHA_MODEL_URL` set | The model writes everything: payload and customer reply. Checks only flag. |
| **Rules as safety net** | `SURAKSHA_MODEL_URL` set and `SURAKSHA_MODEL_AUTHORITY=rules` | The model reads facts and the category; policy rules decide tier, actions, language; templates write the reply. Any failed gate → the rules answer. |
| **Rules only** | no `SURAKSHA_MODEL_URL` | The rules engine and templates. Works on any machine, including a deployed Worker that can't reach a GPU. |

In every mode, PII masking runs first and nothing the model sees contains an unlabelled 12-digit number, a phone number, an OTP or a password.

## Run it

Terminal 1, the model server. It binds to loopback only, NF4 uses about 2.5 GB of GPU memory, and it reuses the cached pinned base weights:

```bash
# model authority: the JSON + reply model
HF_HUB_OFFLINE=1 .venv-training/bin/python scripts/serve_model.py \
  --model artifacts/reviewed/merged-dual-sft-004

# rules as safety net: the JSON-only model (more accurate JSON)
HF_HUB_OFFLINE=1 .venv-training/bin/python scripts/serve_model.py \
  --model artifacts/reviewed/merged-schema-sft-004
```

Terminal 2, the website. `.dev.vars` is gitignored:

```bash
printf 'SURAKSHA_MODEL_URL=http://127.0.0.1:8765\nSURAKSHA_MODEL_TIMEOUT_MS=35000\n' > .dev.vars
# add this line for rules as safety net:
# echo 'SURAKSHA_MODEL_AUTHORITY=rules' >> .dev.vars
npm run dev -- --host 127.0.0.1   # http://localhost:5173
curl -s http://127.0.0.1:5173/api/health
```

`/api/health` reports `engine`: `model_authority`, `model_authority_offline`, `model_first_rules_fallback` or `deterministic_preview`, plus the model identity. `trained_model_connected` is true only when a verified fine-tuned adapter is loaded; a base model is reported as `fine_tuned: false`. The status bar shows "Fine-tuned model writes every answer", "Model offline: no answers until it is back", "Fine-tuned model · rules fallback" or "Rule engine active".

Optional shared secret: set `SURAKSHA_MODEL_TOKEN` in both the server's environment and `.dev.vars`. Only `http://127.0.0.1`, `localhost` and `[::1]` URLs are accepted locally (see *Hosted inference* for anything else).

### Server options

| Option | Default | Meaning |
| :--- | :--- | :--- |
| `--model` | `Qwen/Qwen2.5-3B-Instruct` | A merged model directory, or the base model |
| `--adapter` | none | Serve a LoRA adapter on the pinned base instead of a merged model |
| `--quantization` | `nf4` | `nf4` (≈2.5 GB) or `bf16` |
| `--max-new-tokens` | 256 | Limit for the JSON payload |
| `--max-reply-tokens` | 384 | Limit for a customer reply |
| `--max-queue` | 2 | Requests allowed to wait for the GPU; more get `503 busy` |
| `--queue-timeout` | 35 s | Longest a request may wait |

Requests to `POST /v1/triage` are `{"message", "context", "task"?, "sample"?}`: `task` is `"schema"` (default) or `"reply"`, and `sample: true` asks for a sampled generation (temperature 0.7, top-p 0.9) instead of greedy decoding. The prompt is the exact one used in training (`research/common.py:prompt_for`), checked equal on every training row by `research/test_serve_model.py`.

## Model authority (default)

Implemented in `triageModelAuthority` (`lib/model-triage.ts`).

1. **Payload.** The model writes the 8-field JSON (greedy). It is checked by the gates below. If any check fails, the model is asked once more with `sample: true`; the better attempt is kept (a passing one, else the one with fewer failed checks).
2. **Reply.** The model writes the customer reply (`task: "reply"`), told the language it detected itself (every reply training row named its language; without it, English messages got Hindi replies). It is checked by the reply checks below, with the same single sampled retry.
3. **Show it, flagged if needed.** The answer shown is the model's: no field and no sentence is replaced. Facts that are pure arithmetic on the model's own fields (reversal due date, ₹100/day compensation, evidence spans) are computed from them. `audit.model.authority` records `review_required`, every failed check (`payload_flags`, `reply_flags`) and the attempt counts. The desk shows a red **"Needs human review"** banner listing them, or a green "Written entirely by the model · every check passed".
4. **No answer at all.** If the model is offline, busy, times out, or returns unparseable JSON on both attempts, `/api/triage` answers `503` with `error.code = "model_unavailable"` and the reasons. There is no rules answer to fall back to; the desk says the model could not answer.

A message in a language the model wasn't trained on (anything but English, Hinglish and Hindi) is still sent to it, flagged `language_outside_model_training`.

### Measured (`scripts/eval-authority.ts`, `artifacts/reviewed/eval/authority-dual-004.json`)

`merged-dual-sft-004`, live, through the real pipeline:

| | 54 reviewed test cases | 42 unfamiliar wordings |
| :--- | ---: | ---: |
| Category correct | 96.3% | 76.2% |
| All 8 fields correct | 55.6% | n/a |
| Needs human review (a check failed after the retry) | 22 | 28 |
| Reply passed every check | 36 | 18 |
| Payload retried / reply retried | 13 / 26 | 22 / 33 |
| No answer at all | 0 | 0 |
| Median time per answer | 11.0 s | 11.7 s |

Most frequent failed checks: a liability tier the operator context doesn't support (`tier_requires_policy_revalidation`, `tier_not_supported_by_operator_context`); a language the message isn't in (`language_not_grounded`, 15 on the challenge set, mostly Hinglish read as English); and replies giving another category's advice (`reply_inconsistent_with_category`). Examples read during evaluation, all flagged: fraud advice for a plain failed payment, an invented link (`report.cybercrime.gov.in`), and, before the language fix, a Hindi reply claiming RBI had paid compensation for a lakh-rupee loss on a ₹9,000 case.

Seven demo messages sent to the live site: 6 of 7 flagged for review (details in [VERIFICATION.md](VERIFICATION.md#model-authority-15-november-2026)). The same message can get a different category on a retry, because retries are sampled.

**Why it is weaker than the rules-as-safety-net mode:** the liability tier depends on RBI rules and operator-verified facts the model cannot infer reliably from a message, and the model's replies were learned from the templates, so it mixes up which one fits. Better replies would need human-written reply examples per category.

## Rules as safety net (`SURAKSHA_MODEL_AUTHORITY=rules`)

On each request:

1. The rules engine runs. It redacts PII and computes evidence, SLA and a complete rules payload.
2. The redacted message and operator context are sent to the model (`task: "schema"`).
3. The model's raw text is used only if it passes every gate. Nothing is repaired: a prefix, code fence or misspelled key is a rejection.
4. The policy rules then decide the tier, the actions, the reply language (in auto mode) and a minimum urgency for the model's category; every change is recorded in `audit.model.policy_from_rules`.
5. If a gate fails, or the model is busy, slow or offline, the rules payload is returned with `audit.model = {status: "fallback", reasons: [...]}`.
6. The reply comes from the reviewed templates in the customer's language. With `SURAKSHA_MODEL_REPLIES=true` (serve a JSON + reply model) the model is asked for a reply only after its payload passed; a reply that fails a check is replaced by the template and the reasons are shown.

Measured with `merged-schema-sft-004` (runtime replay and live challenge): **98.1%** all 8 fields on the 54 reviewed test cases, **90.5%** category on the 42 unfamiliar wordings, 2–4 s per answer. See [VERIFICATION.md](VERIFICATION.md#round-4-cases-from-live-testing-14-november-2026).

## Gates and checks

Used as **gates** in rules-as-safety-net mode and as **flags** in model-authority mode (`validateModelPayload`, `validateModelReply` in `lib/model-triage.ts`).

**Payload**

- **Strict JSON**: unique keys, nothing else in the text; matches the payload schema.
- **UTR**: must be a labelled anchor in the message; not one of several (`utr_not_grounded`, `utr_ambiguous`).
- **Amount**: must appear in the message; not one of several (`amount_not_grounded`, `amount_ambiguous`).
- **Reporting delay**: must match operator context.
- **Language**: must match the operator's choice, or in auto mode the detected script/markers (`language_not_grounded`).
- **Category**: may name one when the keyword rules can't, but may not contradict one they found (`model_contradicts_rules_category`, `model_less_specific_than_rules`, `model_misses_fraud_signal`).
- **Liability tier**: `PENDING_VERIFICATION` is always allowed; technical tiers must match the category; zero, limited, bank-policy and negligence tiers must equal what the operator-verified context supports; transactions from 2027 stay pending.
- **Fraud categories** must include `CONTACT_BANK_PSP`, `CALL_1930`, `REPORT_CYBERCRIME`; a missing UTR requires `REQUEST_UTR`.

**Reply**

- not too short or too long; no refund or outcome promise;
- fraud rails (bank/PSP, 1930, cybercrime.gov.in) for a fraud category;
- in the payload's language;
- no UTR, amount, link or phone number that isn't in the message or policy;
- consistent with the category (T+1/T+5 only for technical failures, wrong-beneficiary advice only for wrong-VPA transfers, UTR request when information is missing).

The checks catch these failure classes; they cannot prove that a reply which passes is good advice. No model reply has been human-reviewed for quality.

## Load and timeouts

The server generates one request at a time on the GPU.

- `--max-queue` (default 2) requests may wait; any more get `503 busy` at once.
- The Worker sends its time budget in `x-suraksha-deadline-ms`; work that couldn't start within it is dropped, so the GPU never works for a caller that has given up.
- `SURAKSHA_MODEL_TIMEOUT_MS` (default and cap 35 000 ms) covers every generation for one request, retries included. It stays below the browser's 45 s timeout.
- On `503 busy` or a timeout: rules-as-safety-net mode answers with the rules; model-authority mode answers `503 model_unavailable`.

## Serving an adapter instead of a merged model

```bash
.venv-training/bin/python scripts/serve_model.py --adapter artifacts/reviewed/schema-sft-004/curated-sft
```

The server refuses an adapter whose manifest identity (base revision, weight hashes, tokenizer) differs from the served base, one without a verified optimizer update (`training_outcome.parameters_updated`), and a smoke-test adapter unless `--allow-smoke-adapter` is passed. Unreviewed pilots need `--allow-pilot-adapter` and are labelled as pilots everywhere.

## Hosted inference (deployed Worker)

A deployed Cloudflare Worker cannot reach a laptop. To use a hosted model server, all three are required; otherwise the Worker is rules-only:

- `SURAKSHA_MODEL_ALLOW_REMOTE=true`;
- an `https://` `SURAKSHA_MODEL_URL`;
- `SURAKSHA_MODEL_TOKEN`, sent as a bearer token and set as a secret, never in code.

`serve_model.py` binds to loopback only; put it behind a TLS reverse proxy on the GPU host and start it with the same token. Messages are redacted before they leave the Worker, but a hosted endpoint still receives transaction details and needs the same data-protection approval as any other processor of customer data. In model-authority mode a hosted endpoint that is down means no answers.

## History

- **2026-11-13, base model:** every output fell back (`not_strict_json`): the base model prefixes `JSON:` and misspells `panic_severity`.
- **Round 3 dual model (`merged-dual-sft-003`), replies opt-in:** model replies passed the checks for 27 of 52 reviewed and 16 of 39 challenge cases; they were the templates copied back with errors (`artifacts/reviewed/eval/replies-003.txt`).
- **Round 4 (`merged-schema-sft-004`):** the rules-as-safety-net numbers above.
- **Model authority (`merged-dual-sft-004`):** the numbers above.
