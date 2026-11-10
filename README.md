# Suraksha-Merge / SurakshaDesk

A polyglot UPI fraud and dispute triage research project. It includes a working SurakshaDesk console, an interactive pipeline explorer, provenance-gated curation, specialist-training and merging entry points, and recorded-prediction evaluation.

**Current mode:** rules and response templates. No trained model, no bank/NPCI integration, no disputes filed, no refunds approved. The original proposal's benchmark numbers are unmeasured targets, not results. Merging is a hypothesis to evaluate, not a guarantee of eliminating interference.

## Run

Requires Node 22.18+ (Node 24+ recommended).

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Open the Local URL printed by Vite. `npm test` runs financial-policy and privacy regression checks. `npm run check` checks TypeScript. `npm run build` builds the Worker application.

## What works now

- Reference-inspired payment-security landing page, with icy blue, cyan, lavender and black styling.
- Responsive triage desk with six scenarios, editable messages, language controls, operator context and JSON/provenance views.
- **Multilingual throughout.** The interface ships in English and Hindi and the language travels in the URL, so a view can be linked in the reader's language. The customer draft is written in the language detected from their message, in any of the five supported languages: English, Hinglish, Hindi (Devanagari), Tanglish and Marathi-English.
- **Dictation.** The composer can take a customer message by voice in any supported language. The transcript is re-detected, so the reply follows the language the customer actually spoke.
- **A mascot that helps.** Sūrakṣha reads the state of the desk and says the next thing worth knowing, instead of decorating the page.
- Live `/api/triage` and `/api/health` endpoints, masked trace export and copy/download controls.
- Interactive four-stage architecture explorer and offline merge-weight configuration.
- Versioned policy library and a six-checkpoint benchmark lab that leaves unmeasured scores blank.
- Eighteen synthetic seed cases, isolated scenario-family splits, curation manifests and same-task preference pairs.
- Source-checked AlignTune training and exact weighted-delta merge commands; optional actual CuratorKIT, Presidio and AuditKIT integrations.

Nothing in the interface is hardcoded: every string lives in a typed message catalog or in a content module, and every reply line is a template filled with placeholders. A missing translation is a type error rather than a blank label.

The current default policy is `IN-UPI-2026-11-09`. No customer chats are persisted. Training artifacts, generated datasets, environments and credentials are ignored by Git.

## Where things live

| Path                    | What it holds                                                         |
| ----------------------- | --------------------------------------------------------------------- |
| `lib/i18n/`             | Locale registry, message catalog, reply templates, the React provider |
| `lib/content/`          | Pipeline stages, demo scenarios and the mascot's hints                |
| `lib/rules/`            | Language detection and dispute classification signals                 |
| `lib/engine.ts`         | The rule engine: redaction, extraction, tiers, SLA                    |
| `lib/triage-reducer.ts` | The desk's single source of truth                                     |
| `components/`           | The shell, the desk, the views and the mascot                         |

## API behavior

`POST /api/triage` accepts one `application/json` object with a non-empty message of at most 12,000 UTF-16 characters and documented optional operator context. Duplicate keys, extra fields, impossible calendar dates, malformed UTF-8, non-finite numbers and oversized bodies fail safely. Error responses have a stable `error.code`, a request ID and `Cache-Control: no-store`.

Set `TRIAGE_API_KEY` in the Worker environment to require `x-api-key`. When configured, the desk asks for it after a 401 and retains it only in component memory. It is never put in the URL, browser storage or exported traces. The request limiter is best-effort per Worker isolate; forwarded client headers cannot create arbitrary identities. Messages are processed without application persistence, and internal exceptions log only an error code and request ID.

The desk invalidates results whenever message, date, language or operator context changes. Copy and export stay disabled until the current input has an assessment. Request cancellation and older responses cannot overwrite a newer scenario. The previous result remains available for reference after an error.

See [the verification record](docs/VERIFICATION.md) for tested paths, the built-Worker HTTP check and outstanding validation.

## Research commands

```bash
python3 phase1_curatorkit_pipeline.py --demo
python3 phase2_aligntune_train_and_merge.py --stage plan
python3 -m unittest discover -s research -p "test_*.py" -v
```

See [the research runbook](docs/RESEARCH.md) for optional toolkit installation, GPU training, shared tokenizer/embedding adaptation, all six baselines, actual checkpoint inference and paired-bootstrap evaluation. No trained checkpoints or claimed benchmark percentages are bundled.

## Policy corrections incorporated

- UPI beneficiary-not-credited transfer: T+1; merchant-confirmation failure: T+5. T is a calendar date. ₹100/day applies beyond the appropriate deadline for qualifying failed transactions.
- Early reporting alone does not establish zero liability. Responsibility, authorisation, customer negligence and working days from bank communication must be verified. Conditional 4–7-day caps include ₹5,000 for BSBD, ₹10,000 and ₹25,000 for other specified tiers, capped by transaction value.
- An authorised wrong-VPA transfer does not carry an automatic refund entitlement. No reply claims an action has already been performed.
- Escalation follows the RBI Ombudsman 2026 eligibility rules, including the longer applicable network period and dissatisfied replies. A universal 45-day chargeback window is not assumed.
- A 12-digit number is preserved only with UTR/RRN provenance. Other 12-digit values are masked to avoid exposing Aadhaar. The built-in contextual regex scrubber is not Presidio.
- Commercial-bank liability amendments scheduled for transactions from 1 January 2027 trigger a policy-review boundary for every category, not only the ones without a turnaround deadline.
- A QR code is a payment method, not a fraud signal. Only a market signal (a platform, a buyer, a seller, an advance request) makes a collect-request scam, so an ordinary merchant QR payment keeps its T+5 timeline.
- Fraud evidence outranks a benign reading. "Hacked ... wrong account" is a fraud, not a voluntary transfer, and is never told there is no remedy.

Primary sources and review dates are tracked in [lib/policy.ts](lib/policy.ts). Internal category names are an application taxonomy, not an official UDIR submission contract or regulatory certification. A bank-approved mapping and compliance review are necessary before operational use.

No customer messages are persisted by the app. Exported traces contain masked text; contextual UTRs remain personal transaction references and require controlled handling for real data. Use synthetic scenarios for demonstrations.
