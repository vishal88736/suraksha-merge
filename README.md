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
- Live `/api/triage` and `/api/health` endpoints, masked trace export and copy/download controls.
- Interactive four-stage architecture explorer and offline merge-weight configuration.
- Versioned policy library and a six-checkpoint benchmark lab that leaves unmeasured scores blank.
- Eighteen synthetic seed cases, isolated scenario-family splits, curation manifests and same-task preference pairs.
- Source-checked AlignTune training and exact weighted-delta merge commands; optional actual CuratorKIT, Presidio and AuditKIT integrations.

The current default policy is `IN-UPI-2026-11-09`. No customer chats are persisted. Training artifacts, generated datasets, environments and credentials are ignored by Git.

## Research commands

```bash
python3 phase1_curatorkit_pipeline.py --demo
python3 phase2_aligntune_train_and_merge.py --stage plan
python3 -m unittest research.test_pipeline -v
```

See [the research runbook](docs/RESEARCH.md) for optional toolkit installation, GPU training, shared tokenizer/embedding adaptation, all six baselines, actual checkpoint inference and paired-bootstrap evaluation. No trained checkpoints or claimed benchmark percentages are bundled.

## Policy corrections incorporated

- UPI beneficiary-not-credited transfer: T+1; merchant-confirmation failure: T+5. T is a calendar date. ₹100/day applies beyond the appropriate deadline for qualifying failed transactions.
- Early reporting alone does not establish zero liability. Responsibility, authorisation, customer negligence and working days from bank communication must be verified. Conditional 4–7-day caps include ₹5,000 for BSBD, ₹10,000 and ₹25,000 for other specified tiers, capped by transaction value.
- An authorised wrong-VPA transfer does not carry an automatic refund entitlement. No reply claims an action has already been performed.
- Escalation follows the RBI Ombudsman 2026 eligibility rules, including the longer applicable network period and dissatisfied replies. A universal 45-day chargeback window is not assumed.
- A 12-digit number is preserved only with UTR/RRN provenance. Other 12-digit values are masked to avoid exposing Aadhaar. The built-in contextual regex scrubber is not Presidio.
- Commercial-bank liability amendments scheduled for transactions from 1 January 2027 trigger a policy-review boundary.

Primary sources and review dates are tracked in [lib/policy.ts](lib/policy.ts). Internal category names are an application taxonomy, not an official UDIR submission contract or regulatory certification. A bank-approved mapping and compliance review are necessary before operational use.

No customer messages are persisted by the app. Exported traces contain masked text; contextual UTRs remain personal transaction references and require controlled handling for real data. Use synthetic scenarios for demonstrations.
