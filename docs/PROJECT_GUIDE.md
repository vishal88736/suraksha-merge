# Suraksha Merge Project and Code Guide

This guide explains how SurakshaDesk processes UPI fraud and dispute messages, how its TypeScript application is organized, and how its separate Python research workflow prepares data, trains specialist adapters and evaluates recorded predictions. It is intended for a project owner, reviewer or developer who needs to explain the system and change its code safely.

The working application uses deterministic extraction rules and multilingual response templates. The model training and merging entry points are implemented separately; a trained checkpoint is not connected to the live desk. Understanding that boundary is essential to interpreting the UI, the tests and the research results.

Source snapshot: `541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6`. Repository: https://github.com/vishal88736/suraksha-merge. The file inventory covers all 178 tracked files in that snapshot. This documentation and its Word version are additional documentation artifacts.

## 1 Project purpose and capabilities

A customer reporting a suspicious payment often mixes languages, abbreviates details and forwards fragments of a bank SMS. A useful support tool must identify the transaction, preserve evidence, suggest the appropriate reporting steps and communicate calmly. A valid JSON object alone does not establish that those decisions are correct.

SurakshaDesk accepts a message and optional operator context, masks supported personal identifiers, extracts a labelled reference and explicit amounts, classifies the dispute, assigns a conditional policy tier, estimates an applicable technical-failure timeline and produces a customer draft. The right pane exposes the structured result, warnings and evidence so an operator can review the reasoning.

| Capability | Current implementation | Practical meaning |
| --- | --- | --- |
| Live triage | Shared TypeScript rule engine | No language model is needed to run the demonstration |
| JSON output | Zod payload validation and an HTTP result envelope | The application controls the schema; it is not an official NPCI submission format |
| Customer replies | Five language template bundles | Replies are repeatable and reviewable; linguistic quality still needs human review |
| Interface | English and Hindi catalogs | Interface language and customer reply language are separate controls |
| Privacy | Contextual regex masking and temporary raw reveal | Supported patterns are masked; this does not establish universal PII detection |
| Research data | Eighteen synthetic seed cases and isolated scenario families | Suitable for exercising the pipeline, not for demonstrating generalization |
| Specialist training | AlignTune entry points for schema RLVR and empathy DPO | Execution requires a compatible model environment and deliberate training run |
| Adapter merging | Weighted LoRA updates and compatibility manifests | An implemented experiment, with no measured superiority claimed |
| Evaluation | Recorded outputs, deterministic scorers and optional AuditKIT | Measures supplied predictions rather than displaying invented scores |
| External actions | None | No dispute is filed, payment channel blocked or refund approved by this application |

The intended production role is decision support. A bank would still need verified transaction status, approved reason-code mappings, current policy review, customer consent controls and audited operational integrations before using the output to act on an account.

## 2 Explanation for reviewers

A concise project explanation is: Suraksha Merge is a multilingual UPI dispute triage project that connects evidence extraction with a calm customer response. Its desk makes the extracted fields and policy assumptions visible. Its research track investigates whether two small-model specialists can be combined while retaining both structured accuracy and appropriate language.

The proposed learning problem is task interference. Training a small model to emit rigid JSON and expressive support language may create competing optimization pressures. The project separates the tasks into a schema specialist and a response specialist, then evaluates a weighted combination. That is the research hypothesis; the repository does not establish that interference has been eliminated.

The three toolkits have distinct roles. CuratorKIT provides an optional actual clean, schema, deduplication and export pass after local gates. AlignTune supplies trainer factories, reward registration, tokenizer-extension tooling and a merge helper. AuditKIT can execute custom scorers over recorded predictions or clearly labelled fixtures. The proposal's illustrative toolkit APIs were replaced by source-checked calls in the implementation.

A useful demonstration starts with a Hinglish scam message, runs triage, shows the masked phone number and grounded UTR, explains why unknown responsibility remains pending verification, and copies the draft only after review. Next, select a merchant-failure scenario to show the different technical timeline. Finally, open the pipeline and benchmark views to explain the experiment without treating the weight slider or blank score cells as measured model behavior.

A reviewer should distinguish four questions: does the application behave correctly on its regression cases; do the toolkit integrations execute; does a trained model improve held-out performance; and is the system approved for operational banking use. The first two have recorded implementation evidence. The latter two remain separate validation tasks.

## 3 Architecture and runtime flow

The live path is customer input -> Worker guard -> rule engine -> validated result -> operator review. The separate research path is seeds -> curation -> specialist training -> weighted merge -> recorded evaluation.

The live request path begins in `app/page.tsx`. The composer edits a `TriageInput`; `requestTriage` sends it to `/api/triage`. The custom Worker checks the method, optional key and per-isolate request budget before delegating to Vinext. The route handler reads a bounded body, parses strict JSON and validates the input before calling `triage`.

The engine returns a payload, customer reply, sanitized source, evidence, warnings, SLA estimates and audit flags. The client validates this complete result envelope before dispatching a success action. The reducer accepts only the active request ID and remembers the exact input that produced the assessment. An operator can then inspect or export the result.

The offline path begins with labelled seed records. Python calls the same TypeScript engine through a JSONL subprocess interface to check consistency and sanitize text. Curation exports separate task datasets. Training produces adapter artifacts and provenance manifests. A merge run checks compatibility, combines updates and saves a full model. Prediction generation and evaluation happen after that; none of these steps is invoked by a live desk request.

| Boundary | Data crossing it | Control or limitation |
| --- | --- | --- |
| Browser to Worker | Raw message and optional operator context | HTTPS in deployment, optional key, bounds and schema checks; raw text does reach the server |
| Input to engine | Validated input | Customer text remains untrusted; it cannot execute policy changes or banking actions |
| Engine to browser | Structured result and sanitized source | Runtime response validation prevents arbitrary JSON from becoming a trusted assessment |
| Browser to export | Reviewed result and masked trace | Raw reveal text and redaction offsets are removed from trace privacy metadata; contextual UTRs remain |
| Seeds to training data | Sanitized text, gold payload and provenance | Split isolation, consent requirement for real records, local consistency and policy-pattern gates |
| Adapters to merge | Configuration, weights and manifests | Base identity, vocabulary, stage and file checksums must match |
| Predictions to scoring | Model text, benchmark and inference manifest | Exact sample-ID alignment and checksums protect the denominator and provenance |

## 4 Directory map and reading order

```text
suraksha-merge/
  app/                 Application entry points and API routes
  worker/              Cloudflare Worker request boundary
  components/          Landing, shell, desk, views and UI scaffolding
  hooks/               Dictation and responsive helper hooks
  lib/                 Engine, contracts, state, rules and localization
  data/                Synthetic seeds and portable payload schema
  research/            Python contracts, artifact checks and research tests
  phase1_*.py          Data curation entry point
  phase2_*.py          Training, tokenizer adaptation and merge entry point
  phase3_*.py          Recorded-prediction evaluation entry point
  scripts/             Build, environment, inference and verification tools
  tests/               TypeScript regression suites
  docs/                Research and verification documentation
  db/                  Optional inactive D1 database helper
  examples/d1/         Opt-in example database feature
  public/              Favicon asset
  vendor/              Retained component CSS and licence notice
  .github/workflows/   GitHub verification pipeline
  .openai/             Existing Sites hosting identity and bindings
```

Read `lib/engine.ts` first to understand the product decisions, then `lib/triage-api.ts` and `worker/index.ts` to see the HTTP boundary. Read `lib/triage-reducer.ts` before `app/page.tsx` to understand the UI's state transitions. Next read the three Python phase files with `research/common.py` and `research/artifacts.py` beside them.

The current visible scenarios live in `lib/content/scenarios.ts`. The older `lib/scenarios.ts` remains in the snapshot but is outside the current page's static import path. Editing it does not update the localized scenario picker. Likewise, the 61 files under `components/ui/` are retained component scaffolding; none is statically imported by the active desk entry points in this snapshot. They should not be confused with the bespoke desk panels.

Generated folders such as `node_modules/`, `dist/`, `.wrangler/`, `.sites-runtime/`, `artifacts/`, `checkpoints/` and `data/generated/` are outside the tracked source inventory. They hold dependencies, builds, temporary runtime state or private research outputs and should not be read as authored product code.

## 5 Worked customer example

The following synthetic example was executed through the actual engine for this guide. Its phone number and transaction reference are fixtures.

```json
{
  "message": "Bhai please help!! Buyer ne QR collect request bheja. Rs 24500 debited. RRN 431289014421. Call 9876543210.",
  "reporting_delay_working_days": 0,
  "responsibility": "unknown",
  "language": "hinglish"
}
```

The phone becomes `[PHONE_REDACTED]`. The labelled RRN remains `431289014421`; the amount is 24500. An explicit collect request selects the scam category, and the urgent wording selects high severity. Reporting promptly does not resolve whether the payment was authorized or who was responsible, so the tier remains pending verification.

```json
{
  "utr_number": "431289014421",
  "dispute_category": "COLLECT_REQUEST_SCAM",
  "amount_inr": 24500,
  "reporting_delay_working_days": 0,
  "rbi_liability_tier": "PENDING_VERIFICATION",
  "mandatory_actions": [
    "CONTACT_BANK_PSP",
    "SECURE_PAYMENT_CHANNEL",
    "CALL_1930",
    "REPORT_CYBERCRIME",
    "RAISE_APP_DISPUTE",
    "HUMAN_REVIEW"
  ],
  "detected_language": "hinglish",
  "panic_severity": "HIGH_CRITICAL"
}
```

The generated Hinglish draft begins, "Samajh sakte hain, paise katna kaafi stressful hai. Aaiye, ek-ek step lete hain." It instructs the customer to report to the bank or PSP, secure the payment channel, call 1930, report through cybercrime.gov.in and raise an app dispute with the reference. It says the refund and zero-liability outcome still require bank verification. It does not claim that the software has filed a ticket.

Now change only the operator's reporting delay or responsibility. The previous result is stale immediately because it describes the earlier input snapshot. Copy and export are disabled while stale or running. A new assessment is required even when the message text has not changed.

For a separate merchant-confirmation failure with six elapsed calendar days, the code selects a five-day deadline and estimates INR 100 for one day beyond that deadline. That estimate depends on the classified failure and supplied elapsed-day context; the application does not query a bank ledger to verify whether a reversal already occurred.

## 6 Contracts and JSON schema

The input contract is `inputSchema` in `lib/engine.ts`. A message is required, must contain non-whitespace text and may contain at most 12,000 UTF-16 code units. Leading whitespace is preserved so evidence offsets still refer to the original submitted message. The schema rejects extra fields rather than silently accepting unknown instructions or private metadata.

| Input field | Accepted values | Meaning |
| --- | --- | --- |
| `message` | Non-empty string, maximum 12000 | Raw customer text |
| `reporting_delay_working_days` | Integer 0 to 3650, null or omitted | Delay measured using the bank's working-day calendar |
| `elapsed_calendar_days` | Integer 0 to 3650, null or omitted | Elapsed time for the technical-failure estimate |
| `responsibility` | `unknown`, `bank`, `third_party`, `customer` | Operator-supplied assumption, default unknown |
| `account_tier` | `unknown`, `bsbd`, `regular`, `other` | Coarse application tier for conditional caps |
| `language` | `auto` or one of five reply language codes | Automatic detection or explicit override |
| `transaction_date` | Valid ISO calendar date, year at least 1900 | Date used for the policy-review boundary |

The output payload has exactly eight fields. `utr_number`, `amount_inr` and `reporting_delay_working_days` can be null when unsupported or ambiguous. Category, tier, language and severity are constrained enums. `mandatory_actions` contains application action labels, not evidence that those actions have happened.

| Payload field | Type and contract |
| --- | --- |
| `utr_number` | Twelve ASCII decimal digits or null; a JSON string preserves the identifier |
| `dispute_category` | One of seven internal categories |
| `amount_inr` | Finite positive number or null |
| `reporting_delay_working_days` | Non-negative integer or null |
| `rbi_liability_tier` | One of seven conditional application tiers |
| `mandatory_actions` | Array of approved action enum values |
| `detected_language` | Hinglish, Tanglish, Marathi English, Hindi Devanagari or English code |
| `panic_severity` | `LOW`, `MEDIUM` or `HIGH_CRITICAL` |

`data/triage.schema.json` is the portable research schema. `research/common.py` independently validates the same field set and enums. `lib/triage-response.ts` validates the larger HTTP response consumed by the browser: payload, reply, privacy spans, evidence, warnings, SLA data and audit fields. Updating one contract requires checking the others.

The live HTTP response is an object containing both structured data and reply fields. The research prediction format is different: one payload JSON object, exactly one line containing `---REPLY---`, and a non-empty customer reply. The research delimiter is not part of the live API's JSON syntax.

## 7 Backend request processing

`worker/index.ts` is the outer request boundary. It calls `guardTriageApi` before the Vinext handler. The guard applies only to the triage path, including a trailing slash, so ordinary page and health requests are unaffected. It rejects non-POST methods, checks an optional shared key and then consumes the request budget.

`app/api/triage/route.ts` is deliberately thin: its exported POST handler comes from `createTriageHandler`. Keeping parsing and failure behavior in a separate factory allows tests to inject an engine exception, a short read deadline or a log capture without modifying production globals.

| File and important symbols | Responsibility |
| --- | --- |
| `lib/api-guard.ts` `guardTriageApi` | Method, optional authentication and rate-limit enforcement before framework routing |
| `lib/rate-limit.ts` `createRateLimiter` | Fixed-window counters with injectable clock and bounded bucket storage |
| `lib/rate-limit.ts` `clientKey` and `secretsMatch` | Trusted-edge client identity and fixed-size digest comparison |
| `lib/http.ts` `apiError` | Consistent nested error object, request ID and no-store headers |
| `lib/http.ts` `readBoundedText` | Streaming byte bound, total deadline, abort support and fatal UTF-8 decoding |
| `lib/strict-json.ts` `parseStrictJson` | Native syntax validation plus duplicate-key, depth and finite-number checks |
| `lib/triage-api.ts` `createTriageHandler` | Media validation, strict parsing, schema validation, engine invocation and safe internal failure |
| `lib/triage-client.ts` `requestTriage` | Client deadline, structured error mapping and response validation |

### Body and JSON handling

The route accepts the media type `application/json`, including ordinary media parameters. It does not accept a substring such as `application/json-bogus`. A declared excessive Content-Length is rejected early, but the stream is still counted because an absent or inaccurate header must not bypass the real limit.

The byte limit is 80,000. This leaves room for a 12,000-character Indic message even when JSON uses escaped code points. The default body deadline is five seconds. A stalled stream is bounded by a real timer; cancellation is not awaited indefinitely. Malformed UTF-8 is rejected rather than silently replacing source bytes.

After native JSON syntax parsing, the strict scanner tracks decoded object keys. Thus `"message"` and an escaped spelling of the same key cannot provide conflicting values. Nesting is limited to 48 levels, and numeric overflow such as `1e999` is rejected. The input schema then enforces allowed fields and types.

### Authentication and request budgets

When `TRIAGE_API_KEY` is configured, the Worker requires `x-api-key`. Credentials are hashed to fixed-size SHA-256 values for `timingSafeEqual`; empty or excessively long candidates are rejected. The desk requests the key after a 401 and retains it only in component memory. This is a shared service secret, not a full per-user identity or authorization system.

The default limiter allows 30 triage requests in 60 seconds per client key and keeps at most 10,000 buckets. Expired buckets are swept periodically. A full table refuses new identities rather than evicting active clients and letting a flood reset their quotas. Identity uses Cloudflare's connecting-IP header when supplied by the trusted edge; arbitrary X-Forwarded-For is ignored. Local requests can share the anonymous bucket.

The limiter is local to one Worker isolate. It does not enforce a distributed global quota, and the connecting-IP trust assumption must be reconsidered if this handler is hosted outside the Cloudflare edge.

### Error contract

| HTTP status | Error code | Trigger |
| --- | --- | --- |
| 400 | `invalid_json` | Malformed JSON, duplicate keys, overflow, excessive nesting or malformed UTF-8 |
| 400 | `invalid_input` | Invalid schema field, impossible date or missing usable message |
| 401 | `unauthorized` | Configured shared key absent or incorrect |
| 405 | `method_not_allowed` | Method other than POST on the triage API |
| 408 | `request_timeout` | Body does not complete within its deadline |
| 413 | `payload_too_large` | Byte or message-length budget exceeded |
| 415 | `unsupported_media_type` | Content type is not application/json |
| 429 | `rate_limited` | Request budget exhausted; Retry-After is provided |
| 500 | `internal_error` | Unexpected engine failure |

Errors use `{ "error": { "code", "message", "request_id" } }`. The same request ID appears in `x-request-id`. Validation names only known schema fields, so unexpected submitted field names and values are not echoed. Internal exception messages are withheld from both the response and the normal error log; the log contains an error code and correlation ID.

## 8 Fraud triage engine

`triage` is a pure application decision function apart from timing. It validates input, redacts supported identifiers, extracts evidence, classifies the message, derives a conditional tier and actions, builds SLA estimates, selects language templates and produces audit metadata. It performs no database write or external banking call.

### Numeric normalization and amount extraction

`asciiDigits` in `lib/numbers.ts` maps supported Indic, Arabic and fullwidth decimal digits to ASCII while preserving UTF-16 offsets. `findAmounts` accepts an explicit currency marker such as Rs, INR or the rupee symbol. Plain prose numbers are not treated as money.

Both Indian and Western digit grouping are recognized. Amounts allow at most two fractional digits. The parser calculates integer paise with BigInt, checks its safe range and round-trip precision, then exposes the rupee value as a JavaScript number. Malformed grouping, extra decimal precision or identity-labelled currency-like text marks the scan invalid. If there are multiple different amounts, the final amount is null and a warning requests confirmation.

The wire value remains a JSON number. A production financial ledger should use its own exact decimal or minor-unit representation; the engine's parsing guard does not turn JavaScript number storage into a general accounting type.

### Contextual redaction

`redactPII` claims explicit identity spans before it accepts transaction references. Supported patterns include labelled Aadhaar, labelled account numbers, PAN, spaced sensitive IDs, numeric OTP or PIN-like secrets, Indian mobile numbers, email addresses, VPAs and remaining long digit runs. Numeric email or VPA local parts are masked as a complete address rather than leaving an identifiable suffix.

A twelve-digit run is preserved only when its label identifies a transaction and preceding identity context does not disqualify it. An Aadhaar number disguised as an account reference must not become a UTR. Valid currency spans are exempted from generic phone and unidentified-ID masking, so an amount resembling a phone number is not destroyed.

Spans record start and end offsets in the original message. Replacements are applied from right to left so earlier offsets remain valid. The sanitized string is the classification and language-detection source. This is a contextual regex scrubber; personal names, addresses or unfamiliar identifier formats may require the optional NLP pipeline and additional review.

### Classification precedence

The first matching category wins. This order encodes how the implementation resolves overlapping signals.

| Order | Category | Main evidence |
| --- | --- | --- |
| 1 | `REMOTE_ACCESS_SCAM` | Remote access, screen sharing, AnyDesk, APK or related tooling |
| 2 | `COLLECT_REQUEST_SCAM` | Explicit collect request or market-context QR deception |
| 3 | `UNAUTHORIZED_ACCOUNT_TAKEOVER` | Positive fraud, compromise, impersonation or non-authorization wording |
| 4 | `VOLUNTARY_WRONG_VPA_TRANSFER` | Wrong destination together with stated voluntary or mistaken intent |
| 5 | `P2M_CONFIRMATION_FAILURE` | Technical-failure wording and merchant context |
| 6 | `P2P_BENEFICIARY_NOT_CREDITED` | Technical-failure wording and transfer or beneficiary context |
| 7 | `NEEDS_INFORMATION` | Insufficient evidence for an earlier category |

An ordinary shop QR is not sufficient evidence of a scam. A fraud signal outranks a benign wrong-account interpretation. The `positive` helper excludes immediately negated signals such as "not a scam". This is still a lexical heuristic, and complex negation or quoted descriptions can be misclassified.

### Reporting delay and evidence

Working-day hints are extracted only from explicit working-day wording. Calendar-day text is not silently converted into a regulatory reporting delay. Multiple different hints, an out-of-range hint or a disagreement between a hint and operator context causes abstention. A fraud case with conflicting delay evidence remains pending verification.

The evidence array distinguishes `customer_message` from `operator_context`. Reference and amount evidence include raw-message offsets. Responsibility, tier, date and elapsed-day context are explicitly operator-supplied assumptions. A source match verifies that a value occurred in text; it does not verify a transaction with the bank.

### Function reading map

| Symbol in `lib/engine.ts` | What to understand |
| --- | --- |
| `isCalendarDate` | Validates actual month lengths and leap years rather than accepting date-shaped text |
| `inputSchema` and `payloadSchema` | Define the application boundary and exact payload fields |
| `redactPII` | Builds redaction spans and contextual reference anchors |
| `isFraud` | Shares the fraud-category definition with classification code |
| `draftReply` | Chooses a complete language template bundle and fills supported facts |
| `policyCheck` | Checks selected promise patterns and expected fraud-reporting rails |
| `triage` | Coordinates extraction, policy, reply, evidence and audit output |

The urgency heuristic is separate from fraud classification. It recognizes selected panic terms and punctuation; it is not a clinical assessment or a general sentiment model.

## 9 Policy rules and customer response policy

`lib/policy.ts` stores the dated policy identifier `IN-UPI-2026-11-09`, primary-source URLs and explanatory notes. The application taxonomy is designed for a research desk and requires a bank-approved mapping before official submission. Policy calculations must be read together with their verification assumptions.

For unauthorized cases, bank negligence, a third-party breach and customer negligence follow different branches. The code does not establish responsibility from a frightened message alone. It uses the operator context and preserves an unverified status when the required facts are missing.

| Condition represented in code | Resulting tier |
| --- | --- |
| Fraud and operator marks bank responsibility | `ZERO_LIABILITY_ELIGIBLE` |
| Fraud and operator marks customer responsibility | `CUSTOMER_NEGLIGENCE_REVIEW` |
| Confirmed-context third-party case reported within three working days | `ZERO_LIABILITY_ELIGIBLE` |
| Third-party case reported in four to seven working days | `LIMITED_LIABILITY_ELIGIBLE` |
| Third-party case reported later | `BANK_POLICY_REVIEW` |
| Unknown responsibility or conflicting reporting window | `PENDING_VERIFICATION` |
| Voluntary wrong transfer | `BANK_POLICY_REVIEW` |
| Qualifying beneficiary-not-credited transfer | `TECHNICAL_T_PLUS_1` |
| Qualifying merchant confirmation failure | `TECHNICAL_T_PLUS_5` |

These branches reflect the project policy snapshot. The RBI's 2017 customer-liability circular distinguishes bank negligence, qualifying third-party breaches and customer negligence. Its conditional four-to-seven-working-day caps include INR 5,000, INR 10,000 and INR 25,000 for specified account classes. The code's `bsbd`, `regular` and `other` choices are simplified labels; they do not reproduce every detailed account classification. [RBI customer liability circular](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11040&Mode=0).

The RBI's failed-transaction framework distinguishes a transfer whose beneficiary was not credited from a merchant payment without confirmation. The corresponding application deadlines are T plus one and T plus five calendar days. For a qualifying delayed failure the code estimates INR 100 for each day beyond the appropriate deadline. It cannot verify the qualifying failure or bank payment status itself. [RBI failed transaction framework](https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=11693&Mode=0&fn=9).

A transaction date on or after 1 January 2027 triggers the repository's amendment review guard. Every category's tier becomes pending verification and the reply gains a revalidation note. The code still exposes any classified technical deadline and estimate; the review flag does not independently suppress every SLA field. Treat this as a dated implementation boundary requiring source review, not a dynamically maintained legal rules service.

Fraud drafts include bank or PSP reporting, securing the payment channel, 1930, the cybercrime portal and an app dispute. They describe customer steps rather than claiming execution. Ombudsman text asks the customer to approach the regulated entity first and check eligibility after a dissatisfied reply or the applicable waiting period. The repository uses the 2026 scheme FAQ for that note. [RBI Ombudsman FAQ](https://m.rbi.org.in/commonperson/English/Scripts/FAQs.aspx?Id=3407).

`policyCheck` is a conservative pattern detector. It catches selected English and regional guarantees and checks required text rails. A passing flag does not certify all possible paraphrases, semantic correctness or regulatory compliance. The original proposal's universal 45-day window, blanket three-day zero-liability promise and automatic refund language are not valid assumptions for interpreting this implementation.

## 10 Frontend components and state

`app/page.tsx` coordinates the selected view, reducer, active AbortController, error translations, clipboard notice, evidence tab, scenario choice and experiment controls. It composes smaller components instead of mixing the complete desk into one render block. The server layout installs the localization provider and shared styles.

| Component or module | Role in the visible experience |
| --- | --- |
| `components/landing.tsx` | Reference-inspired payment-security page, navigation, feature explanation and FAQ |
| `components/shell/app-shell.tsx` | Sidebar, top bar, locale selection, mobile navigation and shared footer framing |
| `components/desk/intake-panel.tsx` | Scenario picker, composer, collapsible submitted source and customer draft |
| `components/desk/composer.tsx` | Message editing, dictation, reply language, optional key, date and operator context |
| `components/desk/engine-panel.tsx` | Overview, liability/SLA, payload, privacy summary, guardrail flags and provenance |
| `components/desk/json-view.tsx` | Readable JSON rendering and line presentation |
| `components/desk/masked-text.tsx` | Visual treatment of redacted placeholders and reference anchors |
| `components/mascot/mascot.tsx` | Dismissible state-based guide; not an independent agent |
| `components/views/pipeline-view.tsx` | Four-stage explorer and configurable research merge weights |
| `components/views/benchmarks-view.tsx` | Six checkpoint descriptions with unmeasured values left unclaimed |
| `components/views/policy-view.tsx` | Searchable policy source cards and links |

### State model

`lib/triage-reducer.ts` keeps current input, submitted input, submitted message, latest result, status, error, active request ID, pending input and privacy state together. The status values are idle, dirty, running and error. Loading is derived from status, avoiding a second boolean that could disagree with a cancelled request.

| Action | State transition and reason |
| --- | --- |
| `scenario/select` | Validates the index, creates a fresh local scenario preview and clears old request and reveal state |
| `input/edit` or `input/replace` | Updates current input and marks it dirty when it differs from the assessed snapshot |
| `run/start` | Stores a request ID and immutable pending-input copy, clears errors and hides raw data |
| `run/success` | Accepts only the current request ID, stores its exact input snapshot and retains dirty status if further edits happened |
| `run/error` | Accepts only the current request ID, keeps the previous assessment and exposes retry state |
| `run/cancel` | Clears the matching pending run without discarding the previous assessment |
| `privacy/toggle` | Shows the submitted original temporarily or immediately hides it |
| `privacy/hide` | Returns to masked view and clears the reveal deadline |

`inputsMatch` normalizes both inputs through the schema and compares fields in a stable order. Omitted defaults and explicit unknown values compare consistently. `isStale` checks the complete input, including date, language, account tier and timing fields.

The page aborts the old network request when a newer run or scenario selection occurs. Request IDs provide a second defense: an older completion cannot replace a newer assessment even if cancellation arrives too late. On success, an input edited during the request remains stale until run again.

Initial scenarios are local previews with `hasRun` false. They demonstrate the deterministic engine before an HTTP request. The conversation label distinguishes a preview from the latest submitted assessment; it should not be interpreted as proof of server execution.

### Privacy and export controls

Raw reveal lasts 15 seconds. The original submitted message remains in component state for that reveal; it is not recovered from a redacted server response. A new request and a new scenario hide it again. Copy and download controls are disabled for stale or running results.

The trace exporter removes the privacy redaction arrays and raw submitted message, retaining sanitized text, a redaction count, backend identity, evidence and the policy/audit result. A contextual UTR remains a personal transaction reference, so a masked export is not necessarily anonymous. The API key is never included in that export.

`lib/format.ts` contains display helpers and the browser JSON download routine. Blob URLs are revoked after use. `lib/nav.ts` stores the view in `?view=` and handles browser Back/Forward with `useSyncExternalStore`; the home view removes the view parameter.

## 11 Languages dictation and presentation

The UI locale and the customer's reply language solve different problems. `lib/i18n/locales.ts` defines English/Hindi UI choices and the five reply language codes. `catalog.ts` holds typed interface messages, interpolation and fallback behavior. `replies.ts` holds complete response bundles for each reply language, including fraud steps, technical timelines, voluntary-transfer language and escalation.

`I18nProvider` reads the URL's `lang` parameter first, then the stored locale, and finally the default. It updates the document language and subscribes to storage, popstate and a custom locale-change event. The server and first hydration snapshot use the default locale, after which the browser applies the URL or stored preference. Only the locale preference is persisted in browser storage by this feature.

`detectLanguage` prioritizes script evidence, then language-specific word lists. Devanagari with distinctive Marathi terms selects Marathi English; other Devanagari selects Hindi. Tamil script or Tanglish markers select Tanglish. Roman Marathi markers precede Hinglish markers, with English as fallback. An explicit reply-language selection overrides detection. This is a heuristic detector and can be wrong on short or highly mixed messages.

`useDictation` wraps browser SpeechRecognition or webkitSpeechRecognition. It selects a recognition language tag, accumulates final transcript segments, exposes interim text and handles unsupported, denied, empty and failed sessions. Feature support is read through an external-store snapshot to avoid a server/browser hydration disagreement.

The hook detaches old callbacks before aborting a recognition instance and checks instance identity before consuming results. A language change or unmount tears down the previous session. The latest final callback is kept in a ref so a completed utterance uses current UI behavior. Recognition availability, permissions and browser service behavior still need real browser testing. Browser speech recognition may involve the browser vendor's service; it is separate from the application's no-database-persistence design.

`app/globals.css` owns the desk's responsive layout, readable typography, pastel surfaces, focus indicators, reduced-motion behavior and mobile bottom navigation. The landing page preserves the supplied cyan, lavender and black design direction. Static fallback pages and some diagnostic prose remain English literals; the current project should not be described as having localized every possible error string.

## 12 Data curation pipeline

`phase1_curatorkit_pipeline.py` produces training and benchmark artifacts. The default path runs locally against bundled seeds; it does not call a generative model, semantic judge or adaptive LLM repair service.

Each source row includes a sample ID, scenario group, split, origin, input and gold target. Real records must have a consent/provenance reference. Duplicate sample IDs, unknown split names and scenario families spread across train/validation/test are rejected before curation. Related paraphrases must stay in one scenario family to reduce leakage.

### Curation sequence

1. Validate IDs, split membership, scenario-family isolation and consent metadata.
2. Call `engine_batch` on source inputs for sanitized messages, extracted payloads and evidence.
3. Run both chosen and rejected reply text through the same masking interface.
4. Optionally run Presidio after contextual masking, protecting only labelled transaction anchors.
5. Deduplicate normalized sanitized messages by a digest and reject invalid gold schemas.
6. Compare all gold fields with the engine result, check reference provenance and check reply patterns and fraud rails.
7. Build task-specific prompts and export accepted records, failures, preference pairs and provenance.
8. Optionally run actual CuratorKIT cleaning, schema, exact-deduplication and Alpaca export over sanitized SFT training records.
9. Write a dataset manifest and card; return a failing CLI exit code if no record was accepted.

The gold-versus-engine gate is a consistency check. The engine is also a source of the bootstrap reply templates, so passing this gate is not independent proof that a gold policy interpretation or regional-language response is correct. Human review remains necessary.

`presidio_scrub` replaces protected reference values with numbered anchor tokens, runs supported English recognizers, filters overlapping detections and restores the anchors. It queries which recognizers are installed rather than assuming every Indian entity type is available. It requires the optional analyzer, anonymizer and NLP model. This path has not been executed in the recorded verification.

### Dataset formats and artifacts

| Artifact under each split | Fields or purpose | Consumer |
| --- | --- | --- |
| `rlvr.jsonl` | prompt, answer, ground_truth_json, provenance | Schema specialist |
| `dpo.jsonl` | prompt, chosen, rejected, diagnostic_reason, provenance | Empathy/policy specialist |
| `sft.jsonl` | instruction, input, output, provenance; schema and reply rows | Curated monolithic baseline |
| `uncurated_sft.jsonl` | Same split and PII hygiene, but preserves selected unsafe reply targets | Uncurated baseline |
| `benchmark.jsonl` | sample ID, family, dual/schema/reply prompts, target, reference reply, provenance | Inference and evaluation |
| Root `accepted.jsonl` | Accepted provenance records | Audit and dataset accounting |
| Root `rejected.jsonl` | Failure reason and sanitized source where applicable | Inspection and repair planning |
| Root `recovery_pairs.jsonl` | Labelled deterministic template replacement pairs | Inspection of preference construction |
| Root `manifest.json` | Counts, family splits, policy IDs, tool mode and owned-file hashes | Training integrity gate |
| Root `dataset_card.md` | Bootstrap status and corpus limitations | Dataset readers |

The uncurated baseline is still PII-scrubbed. It intentionally differs in target quality, not in consent or privacy discipline. The DPO pair must answer the same reply task; a broken extraction JSON is not substituted as a rejected conversational answer. Only a distinct rejected reply matching the unsafe-guarantee pattern is admitted as this implementation's hard negative.

`DiagnosticProbe`, `HallucinationGate` and `RewardRefiner` names from the proposal describe intended richer components. The local implementation uses explicit deterministic checks and a labelled template replacement. It does not pretend that those unconfigured semantic services ran.

## 13 Specialist training and merging

`phase2_aligntune_train_and_merge.py` exposes plan, optional tokenizer adaptation, schema training, empathy training, two SFT baselines and merging. Plan mode prints configuration and package availability without downloading a model. Training checks CUDA by default; `--allow-cpu` is an explicit small-smoke-run override.

The default model identifier is `Qwen/Qwen2.5-3B-Instruct`. A tokenizer extension is optional. Both specialists must use exactly the same base weights, vocabulary and LoRA configuration before their updates can be combined meaningfully.

### Data and identity checks

`check_data` requires a manifest, verifies the listed dataset hashes and rejects path traversal, empty data and missing required training streams. Bootstrap data is refused unless `--allow-bootstrap-data` is explicit. That switch authorizes an experimental smoke run; it does not make synthetic labels human-reviewed.

`identity` resolves a remote configuration commit and loads the tokenizer at that same resolved revision. It fingerprints the vocabulary and records rank, alpha and target modules. Local bases are identified by weight bytes and vocabulary rather than their folder name. `materialize_base` downloads the selected immutable snapshot before weight loading. `resolve_shared_base` chooses an explicitly adapted folder or the original base.

`assert_tokenizer_matches_model` requires tokenizer length to equal the input embedding row count. This catches inconsistent adaptation, but strict equality may need compatibility review for models with padded embedding vocabularies. A successful static or unit check does not prove that every supported model can pass a real load.

### Shared tokenizer adaptation

`adapt_tokenizer` uses AlignTune's TokenizerExtender to select Devanagari and Tamil candidates from the training corpus. It adds those candidates and selected domain tokens to the actual Hugging Face tokenizer, resizes the model embeddings and saves one shared adapted base.

The function freezes the base parameters and trains input/output embedding parameters with gradient hooks that zero the old vocabulary rows. AdamW uses zero weight decay for this adaptation. Seed 42 is set before new embedding rows are created. The report records vocabulary sizes, token digest, training steps and observed losses.

The current adaptation branch loads `args.base` directly and does not pass the CLI `--revision` through those initial tokenizer/model loads. Use an immutable local base or extend that branch before claiming the same remote revision pinning as training and inference. The tiny seed corpus also cannot establish that added tokens improve tokenizer fertility or language quality.

### Trainer configuration

| Setting | Schema specialist | Empathy specialist | SFT baselines |
| --- | --- | --- | --- |
| AlignTune factory | `create_rl_trainer` | `create_rl_trainer` | `create_sft_trainer` |
| Algorithm | `drgrpo` | `dpo` | SFT |
| Dataset | train/rlvr | train/dpo | train/sft or train/uncurated_sft |
| Special configuration | Custom verifiable reward, two generations | beta 0.1 and chosen/rejected mappings | Instruction/input/output mappings |
| Shared LoRA | Rank 32, alpha 64 | Rank 32, alpha 64 | Rank 32, alpha 64 |
| Shared optimization | Batch 1, gradient accumulation 2, learning rate 0.000005, seed 42, maximum sequence 2048 | Same | Same |

Target modules are q, k, v and o attention projections plus gate, up and down MLP projections. The default step limit is 100 and is a smoke configuration, not a demonstrated convergence recipe. The backend is TRL; the implementation does not rely on the proposal's assumed automatic Unsloth fallback.

`register_reward` installs a custom reward class using AlignTune's registry contract. A missing answer fails explicitly. Valid JSON alone earns no high reward: the verifier checks every field and caps credit when critical fields are wrong. If schema validation fails, reward is minus one. Otherwise a full critical match earns 0.2 plus 0.8 times the all-field match fraction; a critical mismatch earns only 0.2 times that fraction. Action order is ignored because actions represent a set of obligations.

`train` refuses to overwrite an output with existing adapters or checkpoints. After training, it verifies that a complete safetensors adapter actually exists, including checkpoint-only saves. It then writes identity, dataset digest, algorithm, stage, versions, seed and artifact fingerprints. A trainer returning without persisted weights is an error.

### Weighted merge mathematics

The merged weights equal the shared base plus the weighted schema update and weighted empathy update. Each update is a scaled low-rank matrix product.

The implementation uses a schema weight of 0.55 and empathy weight of 0.45 as defaults. These are experiment settings, not validated optimum values. The slider exports settings and does not change the desk's live decisions.

A LoRA update is the scaled product of two low-rank factors. Averaging each adapter's A and B factors independently introduces cross products between unrelated factors. The code instead asks PEFT for a weighted adapter with `combination_type="cat"`, which composes the weighted update products. With two rank-32 specialists, the combined adapter can have rank 64 before it is baked into the full model.

`merge` verifies both adapter fingerprints, matching identity and expected schema/empathy stage order. It loads the shared base and tokenizer, checks embeddings, activates the combined adapter and calls AlignTune's `PEFTMerger` to save the merged full checkpoint. Its manifest records weights and `evaluated: false`. No TIES, density sweep or alternative merge method is implemented by this entry point.

A baked full model avoids loading two independent adapters during deployment. It does not imply zero inference time, one generation call per ticket or a proven absence of task interference. Those claims require measurement.

## 14 Inference and evaluation

`scripts/generate_predictions.py` performs actual inference when run in a model environment. It loads the immutable base snapshot or local model, verifies an optional adapter against that base, and processes each benchmark case in two task-prefixed calls to the same checkpoint.

The first call asks for schema output. The second asks for a customer reply and includes the first output as an untrusted model draft. It does not inject the gold target into the held-out reply prompt. The two outputs are joined with the research delimiter. No repair pass cleans malformed JSON or unsafe text before scoring.

Generation uses deterministic decoding with `do_sample=False`, a configured token cap, model chat formatting and inference mode. Recorded latency includes both calls, with CUDA synchronization around the measurement. Token counts include both inputs and outputs. The inference manifest records the benchmark and prediction digests, identity, device, generation settings and `repairs_applied: false`. This command has not been run with downloaded model weights in the recorded project verification.

### Checkpoint comparison

The six comparison labels are base, uncurated-sft, curated-sft, schema, empathy and suraksha-merged. The base label is the default named baseline. Reordering command flags cannot silently change it. Missing configured baseline labels, duplicate prediction IDs, missing cases and extra cases fail instead of shrinking the denominator.

| Metric | What the code measures | What it does not establish |
| --- | --- | --- |
| `schema_pass` | Exact portable payload schema | Correct facts |
| `dual_contract_pass` | Valid payload and exactly one delimiter with a non-empty reply | Appropriate customer language |
| `field_exact_match` | Mean exact match over all eight fields | Semantic equivalence of unsupported paraphrases |
| `all_fields_exact` | Every field matches; action ordering ignored | Independent truth of the gold labels |
| `utr_and_tier_exact` | Correct reference and tier together | Full payload accuracy |
| `unauthorized_guarantee_pattern_rate` | Selected unsafe claim patterns | All possible unsafe promises |
| `required_fraud_rails` | Expected reporting text for fraud cases | Successful reporting or account freezing |
| `chrf` | Optional character overlap with a reference reply | Empathy or regulatory compliance |
| `human_empathy_score` | Null until an actual human study exists | An automatic proxy score |
| `inference_cost_per_1000` | Null without measured costing | The proposal's unmeasured dollar estimate |

Utility is zero when the dual contract is incomplete. Otherwise the evaluator combines 0.4 for schema validity, 0.4 for all-field exactness and 0.2 for a no-guarantee-pattern reply with required fraud rails. These weights define an engineering summary score; they are not bank-approved risk weights.

`paired_bootstrap` groups cases by scenario family, resamples families with replacement and compares paired right-minus-left utility on the same sampled cases. It uses seed 42 and 2,000 repetitions by default, and rejects fewer than 20 repetitions. Its percentile interval describes uncertainty under the supplied benchmark; it does not remove label bias, leakage or the limits of five synthetic held-out cases.

`auditkit_evaluate` supplies a callback that returns recorded outputs to actual AuditKIT scorer functions. It is not another model inference pass. `scripts/verify_research.py` deliberately feeds valid and unsafe fixtures, labels the result `SCORER_FIXTURE_VERIFICATION` and confirms scorer behavior. The report always keeps `model_quality_claim_permitted` false and separately records whether benchmark provenance says human-reviewed.

The repository contains adversarial seed and regression cases, including refund coercion and instruction-like input. It does not currently run the proposal's full live RedTeamRunner probe suite from the phase-three entry point.

## 15 Artifact integrity and privacy

`research/artifacts.py` makes checkpoint and prediction checks usable without loading Torch. `file_digest` hashes files in chunks. `adapter_fingerprints` requires both adapter_config.json and adapter_model.safetensors. A configuration alone is not a trained artifact.

`write_adapter_manifest` writes the manifest at the saved checkpoint and its output root, with a relative checkpoint location. `resolve_adapter` supports checkpoint-only outputs and moved directories, rejects a resolved path outside the selected root, and compares current file hashes with recorded hashes. An old absolute folder path does not become authority to read arbitrary files.

`safe_dataset_file` similarly rejects absolute paths and traversal outside the dataset root. `verify_prediction_manifest` requires matching benchmark and prediction digests, a model identifier and an explicit no-repair statement. An evaluator import escape hatch is available, but imported text without verified provenance must not be presented as measured model inference.

`research/common.py` supplies strict JSON, schema checks, all-field comparison, deterministic rewards, task prompts and the Node bridge. `write_jsonl` creates a private temporary file in the destination directory, flushes and fsyncs it, then atomically replaces the target. A serialization failure leaves the previous file intact and removes the temporary artifact. This protects write consistency, not the semantic validity of the labels.

The web app does not persist customer messages in its own database. Raw input is held in browser state and transmitted to the Worker for a submitted run. The runtime regex output and exported traces can retain transaction references. Server hosting logs, browser speech services and operational exports have their own handling requirements; no-storage behavior in application code does not guarantee that every surrounding service is data-free.

No source credential, API key, raw private chat or trained weight is intended for the public repository. `.gitignore` excludes environments, runtime files, generated datasets, artifacts, checkpoints and environment-variable files. Ignoring a path does not retroactively remove a secret already committed; review staged files before publishing.

## 16 Infrastructure deployment and optional integrations

The application uses React 19.3.1 with Next-compatible app routes through Vinext 1.4.4, Vite 8.3.7 and the Cloudflare Vite plugin. `package-lock.json` pins the resolved npm graph. Node 22.18 or newer is required, and GitHub CI uses Node 24.

`vite.config.ts` combines Vinext, the Sites build plugin, optional local connector preview and Cloudflare environments. The custom Worker entry is `worker/index.ts`. The hosting manifest retains the existing Site identifier and currently has unused D1 and R2 bindings set to null. It contains identity and configuration, not credentials.

`next.config.ts` disables the powered-by header and supplies content-type, frame, referrer and permissions policies. Microphone access is allowed for same-origin dictation while camera and geolocation are disabled. These headers are controls within the current framework integration; they are not a complete security certification.

### Build and environment helpers

| Files | Role |
| --- | --- |
| `scripts/execution-profile.mjs` | Reads checkout-local portable or managed-linux selection; clean clones default to portable |
| `scripts/run-framework.mjs` | Chooses the applicable Vinext or Vite command and managed build wrapper |
| `scripts/build-verified.sh` | Bounds the managed build using GNU timeout |
| `scripts/tool-environment.mjs` | Sets local tool-state paths and disables default tool telemetry where configured |
| `scripts/sites-env.mjs` and `.sh` | Establish project root and writable local runtime directories |
| `scripts/install-ci.mjs` and `.sh` | Install the pinned dependency graph using the appropriate execution profile |
| `scripts/npm-install.mjs`, `pnpm-install.mjs`, `install-pnpm.sh` | Package-manager support for portable and managed environments |
| `scripts/vite/sites-vite-plugin.ts` | Preserves platform auth/build integration and emits deployment support assets |

The build produces a server Worker under `dist/server/` and browser assets under `dist/client/`. A release must associate the exact pushed source commit with its matching archive, preserve the existing Site audience and confirm deployment status. A public GitHub repository does not automatically make the hosted Site public.

### Optional connectors

The connector contract is separate from banking. `connector-context.ts` uses AsyncLocalStorage to keep a trusted binding scoped to one request. `connectors.ts` creates a request-specific API from that binding. `connector-contract.mts` validates context shape, blocks browser use and returns explicit statuses such as unavailable, expired, rate-limited or upstream failure.

`connector-errors.mts` projects runtime results onto a validated response and derives recovery UI. A transport failure is unconfirmed: the action may have completed, so the code does not automatically replay it. Local preview scripts implement schemas, a short-lived driver session, host binding and an auxiliary Worker. The live triage engine does not invoke these connectors to contact a bank or NPCI.

### Optional database

`db/index.ts` exposes a Drizzle D1 helper only when a DB binding is present. `db/schema.ts` is intentionally empty. The notes example lives under `examples/d1/` and is not an active app route. Its migration-related message refers to an optional example workflow; there is no current db:generate script in the active package. Do not treat the example as installed storage or an operational ticket ledger.

## 17 Setup and commands

Run commands from the repository root. The web desk and basic regression checks do not require Torch, a GPU, a model download or any paid model-provider key.

### Start the desk

```bash
git clone https://github.com/vishal88736/suraksha-merge.git
cd suraksha-merge
npm ci
npm run dev -- --host 127.0.0.1
```

Open the Local URL printed by the development server. The portable wrapper uses port 5173 by default. Views use query parameters, for example `?view=desk&lang=hi`, rather than separate page-route directories.

### Build and verify

```bash
npm test
npm run check
npm run build
npm audit
python3 -m unittest discover -s research -p 'test_*.py' -v
```

Basic Python tests use standard-library facilities and call the installed Node engine. For a built-Worker HTTP check, start a fresh local Worker in one terminal and run the checker in another. The fixture key below is deliberately not a production secret.

```bash
npm run start -- --port 8791 \
  --var TRIAGE_API_KEY:local-smoke-fixture-only
# In a second terminal
TRIAGE_SMOKE_API_KEY=local-smoke-fixture-only \
  node scripts/smoke-http.mjs http://127.0.0.1:8791
```

The smoke script accepts local hosts only and deliberately exhausts the local request budget near the end. Restart the test Worker before a repeat run or wait for its budget to expire. This script verifies HTTP behavior; it does not drive the browser UI.

### Run local curation and scorer checks

```bash
python3 phase1_curatorkit_pipeline.py --demo
python3 phase2_aligntune_train_and_merge.py --stage plan
python3 scripts/verify_research.py
```

For actual optional CuratorKIT and AuditKIT integration, create a separate Python 3.12 environment and install the relevant pinned requirement files. Presidio additionally needs a compatible NLP model. Keep the GPU environment separate from the web runtime.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python \
  -r requirements-curation.txt -r requirements-audit.txt
.venv/bin/python phase1_curatorkit_pipeline.py \
  --demo --use-curatorkit
.venv/bin/python scripts/verify_research.py --auditkit
```

### Run a deliberate training experiment

The following sequence requires a compatible CUDA training host. The bootstrap override is shown only to make a small research smoke run explicit. Use reviewed data and remove that override for a defensible study.

```bash
uv venv --python 3.12 .venv-training
uv pip install --python .venv-training/bin/python \
  -r requirements-training.txt
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage schema --allow-bootstrap-data --max-steps 100
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage empathy --allow-bootstrap-data --max-steps 100
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage curated-sft --allow-bootstrap-data --max-steps 100
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage uncurated-sft --allow-bootstrap-data --max-steps 100
.venv-training/bin/python phase2_aligntune_train_and_merge.py \
  --stage merge --allow-bootstrap-data --schema-weight 0.55
```

To use an adapted vocabulary, first run the `adapt-tokenizer` stage with a suitable corpus, then pass the same `--shared-base checkpoints/shared-indic-base` to both specialists, both comparison baselines where appropriate, and merging. Do not mix an adapted specialist with the original tokenizer or base.

### Generate and compare predictions

```bash
.venv-training/bin/python scripts/generate_predictions.py \
  --model Qwen/Qwen2.5-3B-Instruct \
  --output artifacts/base.jsonl
.venv-training/bin/python scripts/generate_predictions.py \
  --model checkpoints/suraksha-merged \
  --output artifacts/suraksha-merged.jsonl
.venv/bin/python phase3_auditkit_eval.py --auditkit \
  --predictions base=artifacts/base.jsonl \
  --predictions suraksha-merged=artifacts/suraksha-merged.jsonl
```

That last command is a two-checkpoint comparison. To complete the planned ablation, generate the remaining four recorded runs and pass all six labels. An unmerged specialist uses its shared base as `--model` and its verified checkpoint directory as `--adapter`. Keep prompts, generation limits, data splits and hardware conditions consistent across comparisons.

## 18 Tests and evidence

The recorded verification for source snapshot 541d5b6 includes 87 app regressions, 24 Python research regressions, a TypeScript check, a production build and 12 built-Worker HTTP checks. The local HTTP run issued 40 synthetic requests. GitHub's Verify workflow passed for that commit, including the isolated Worker check.

| Test file or command | Main coverage |
| --- | --- |
| `tests/api-triage.test.ts` | Basic API payload, malformed body, media, bounds and correlation headers |
| `tests/backend-hardening.test.ts` | Duplicate keys, non-finite JSON, invalid UTF-8, real deadlines, safe exception handling, quotas and authentication |
| `tests/engine.test.ts` | Policy boundaries, ambiguity, amount precision, identity masking, classification precedence, contextual references and future-date review |
| `tests/i18n.test.ts` | Catalog completeness, template completeness, language selection and policy rails across reply languages |
| `tests/triage-client.test.ts` | Client/server contract agreement, invalid responses, retry metadata, timeout and cancellation |
| `tests/triage-reducer.test.ts` | Every input invalidates old results, request races, scenario resets, edit-during-run and privacy expiry |
| `research/test_pipeline.py` | Strict reward and contracts, curation, gold checks, split leakage and aligned evaluation |
| `research/test_integrity.py` | Checkpoint resolution, tamper checks, atomic files, path bounds, baseline stability and resolved-revision loading |
| `scripts/smoke-http.mjs` | Built Worker HTML, health, methods, keys, grounding, PII, body limits, Indic budget and bursts |
| `scripts/verify_research.py --auditkit` | Actual AuditKIT scorers over explicitly valid and unsafe fixtures |

The recorded CuratorKIT pass processed 20 sanitized SFT training records. The AuditKIT fixture check used five valid and five unsafe outputs. These observations demonstrate integration and scorer plumbing, not a trained model's accuracy or empathetic language quality. The dependency audit reported zero known npm vulnerabilities at the verification date; that result can change as advisories change.

The workflow in `.github/workflows/verify.yml` installs dependencies on Node 24, runs app tests and TypeScript, selects Python 3.12, discovers both research suites, builds the application and launches an isolated local Worker for the HTTP smoke script. It waits for health, uses a synthetic key and tears down its owned process.

Browser visual and interaction review, microphone behavior, GPU training, actual checkpoint inference, Presidio NLP execution, a human empathy study and operational banking integration are outside the recorded evidence. HTTP 200 responses for query views do not establish hydration, keyboard behavior or visual correctness in a browser.

The source verification record is `docs/VERIFICATION.md`. The matching CI run is https://github.com/vishal88736/suraksha-merge/actions/runs/42878086664. Verification evidence should remain attached to its commit instead of being treated as timeless project-wide proof.

## 19 Changing and extending the code

### Add a scenario

Edit `lib/content/scenarios.ts`, including localized title, description, language and validated input context. Add a regression that checks its expected payload and reply language. Add an independent seed case only when its target and provenance have been reviewed; do not assume a UI scenario automatically becomes a training example.

### Add a dispute category

Update the TypeScript category enum and classification precedence, then adjust tier/action logic and reply selection. Update `data/triage.schema.json` and the Python category set. Add examples for ambiguous overlapping signals and negative cases, because moving a rule upward can change existing classifications. Review UI category presentation and all relevant language bundles.

### Add a reply language

Extend the reply-language union, locale registry and complete template contract. Add detection signals and a dictation language mapping where supported. Verify every placeholder and fraud-reporting rail. Human review is required for meaning, respectful tone and policy wording; matching a template's key count does not prove translation quality.

### Change a policy rule

Review the primary source and effective dates first. Update `lib/policy.ts`, engine branches, research prompts, portable schema enums if needed, reply templates, seed labels and both language catalogs. Add boundary tests on either side of the effective date. Preserve the distinction between calendar and working days and between eligibility and verified outcomes.

### Connect a trained model

Add a server-only inference boundary with request and response budgets, model version provenance, strict structured validation and explicit fallback behavior. Decide whether extraction and reply remain two separate calls. Preserve unrepaired outputs for evaluation, and do not send raw customer data to an external provider without the appropriate controls. Connecting a checkpoint is a new integration; changing a model label in the UI does not implement inference.

### Add real storage or banking actions

Design a separate operational contract for identity, authorization, idempotency, audit retention and error reconciliation. Enable D1 or another store deliberately, write actual schemas and migrations, and separate drafts from confirmed actions. A network timeout must not be interpreted as proof that an external action failed or is safe to repeat. No such banking action exists in the current engine.

### Choose merge weights

Sweep weights using validation data, including specialist-only endpoints and the monolithic baseline. Freeze the selection procedure before the held-out test comparison. Track format, all-field correctness, unsafe promises and human language quality separately. A single weighted utility value can hide a serious failure in one dimension.

## 20 Troubleshooting and current limitations

| Symptom | Likely cause | Next check |
| --- | --- | --- |
| Desk requests a key | Worker has TRIAGE_API_KEY configured | Use the authorized service key; keep it out of URLs and exports |
| 429 response | Local or edge request budget exhausted | Inspect Retry-After; restart only an owned local smoke Worker when appropriate |
| Previous result cannot be copied | Message or operator context changed | Run triage again; do not copy an obsolete eligibility assessment |
| Reply stays in an unexpected language | Short mixed text matched a heuristic or a manual override | Inspect the reply-language selector and detection word lists |
| Reference becomes null | Missing label, identity context or conflicting references | Use the bank receipt to identify one disputed UTR; do not whitelist all twelve-digit numbers |
| Amount becomes null | Missing currency marker, malformed precision or conflicting amounts | Inspect the raw source and verify the transaction receipt |
| Dictation is absent or denied | Browser capability, HTTPS or microphone permission | Check the supported browser and permissions; use typed input meanwhile |
| Training refuses data | Empty, unreviewed, modified or missing split artifacts | Inspect dataset manifest and curation rejections; rerun curation when justified |
| Merge refuses adapters | Base, vocabulary, stage or fingerprint mismatch | Compare both manifests and verify the selected shared base |
| Prediction evaluation fails | Missing IDs, duplicate IDs or mismatched inference manifest | Regenerate aligned predictions; never silently drop cases |
| Scorer results appear perfect | Fixture mode is being viewed as a benchmark | Inspect report mode and model-inference evidence |
| D1 helper fails | Optional database binding is inactive | Check hosting configuration; the active desk does not need DB |

Known design limits are local and specific. Classification and policy gates are lexical heuristics. The policy snapshot does not refresh itself. Elapsed and working days are operator inputs rather than a bank calendar or transaction-status query. Redaction is pattern-based, and a preserved UTR still identifies a transaction.

The tokenizer-adaptation revision handling and strict embedding-vocabulary equality require model-environment review before a reproducibility claim. The optional notes example is retained scaffolding, and the old scenario module is not the current content source. Static error pages contain English text; one error-boundary message about whether a message was sent must not be used as network evidence.

Model training, inference, regional human review and the full red-team probe suite remain work for the research host. Operational use additionally needs approved bank mappings and integrations, stronger deployment identity and distributed abuse controls where required. Successful tests establish the exercised behavior, not universal correctness or compliance certification.

## 21 Glossary and references

| Term | Meaning in this project |
| --- | --- |
| Triage | Organizing a report into facts, a category, review conditions and next steps |
| UPI | Unified Payments Interface |
| PSP | Payment service provider or app channel used for the transaction |
| UTR or RRN | Transaction reference represented by a contextually labelled twelve-digit string in this application |
| P2P and P2M | Peer transfer and merchant payment contexts |
| TAT | Applicable turnaround timeline |
| PII | Information that can identify or relate to a person |
| Provenance | The source, policy snapshot, evidence and integrity metadata associated with an artifact |
| SFT | Supervised fine-tuning on target responses |
| RLVR | Reinforcement learning with verifiable rewards |
| GRPO and DrGRPO | Group-relative policy optimization variants used by the schema training path |
| DPO | Direct preference optimization using chosen and rejected replies |
| LoRA | Low-rank trainable parameter updates to a shared base model |
| Task arithmetic | Combining compatible parameter updates with selected weights |
| ChrF | Character n-gram overlap with a reference text |
| Bootstrap | Repeated resampling used here to estimate paired comparison uncertainty |
| Worker isolate | An individual execution environment with its own local in-memory counters |
| D1 and R2 | Optional Cloudflare database and object-storage services |

The primary implementation reference is the pinned source tree: https://github.com/vishal88736/suraksha-merge/tree/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6. Each file in the appendix links to that snapshot. Detailed research commands and boundaries are also maintained in `docs/RESEARCH.md`.

The policy source registry is `lib/policy.ts`. It includes the RBI customer-liability circular, failed-transaction framework, NPCI dispute-redressal page, cybercrime portal, RBI Ombudsman FAQ and the amendment source used for the date-review guard. These links identify review inputs; they are not an automated regulatory update feed. The operational policy owner must review the applicable text and effective date before changing the guard.

Toolkit source revisions are pinned in `research/toolkit_revisions.json` and the three optional requirement files. CuratorKIT uses revision cee1aed21d14992f650c5dfe09094b9625d0ce87, AlignTune uses 9a80753f2f0af7c5d9b1246904035e9149ea30e1, and AuditKIT uses 9da5838e61ef54d560a37605ddbcb19aceded9b3. Their upstream licence terms and dependency requirements remain applicable.

## Appendix A Complete source file inventory

The inventory below covers every tracked file in the described source snapshot. Core behavior is explained in the numbered chapters; this appendix identifies ownership and makes the remaining configuration, scaffolding and support files discoverable. Generated build files, installed packages, credentials and private runtime data are deliberately outside this source inventory.

| File | Purpose |
| --- | --- |
| [.github/workflows/verify.yml](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/.github/workflows/verify.yml) | GitHub workflow for Node and Python checks, production build and isolated Worker HTTP verification. |
| [.gitignore](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/.gitignore) | Excludes dependencies, build products, credentials, private data and research runtime artifacts. |
| [.npmrc](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/.npmrc) | Repository package-manager settings; dependency security is checked explicitly with npm audit. |
| [.openai/hosting.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/.openai/hosting.json) | Existing Sites identity and optional storage bindings; does not contain deployment credentials. |
| [README.md](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/README.md) | Project introduction, launch instructions, API behavior and links to research and evidence. |
| [app/api/health/route.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/api/health/route.ts) | GET health response describing the actual rule/template runtime and inactive external capabilities. |
| [app/api/triage/route.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/api/triage/route.ts) | Thin POST export using the tested triage handler factory. |
| [app/error.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/error.tsx) | Client render-error boundary with digest logging and retry control; English fallback copy. |
| [app/globals.css](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/globals.css) | Shared console styles, responsive breakpoints, focus states, reduced motion and reference landing design. |
| [app/layout.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/layout.tsx) | Root HTML, metadata, viewport, global CSS and I18nProvider boundary. |
| [app/not-found.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/not-found.tsx) | Fallback for nonexistent routes with a return link. |
| [app/page.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/page.tsx) | View composition, request lifecycle, reducer, scenario changes, clipboard and masked export actions. |
| [cloudflare-env.d.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/cloudflare-env.d.ts) | Optional DB, BUCKET and TRIAGE_API_KEY Worker environment types. |
| [components.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components.json) | Component scaffold configuration and path aliases for the retained UI kit. |
| [components/connector-error.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/connector-error.tsx) | Optional connector recovery presentation; not part of active fraud triage. |
| [components/desk/composer.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/composer.tsx) | Editor, request/retry controls, voice input, reply language, service key and operator context. |
| [components/desk/engine-panel.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/engine-panel.tsx) | Assessment overview, JSON/provenance tabs, SLA and guardrail presentation. |
| [components/desk/intake-panel.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/intake-panel.tsx) | Localized scenario selector, submitted-source reveal and reviewable customer draft. |
| [components/desk/json-view.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/json-view.tsx) | JSON text presentation with readable token/line styling. |
| [components/desk/masked-text.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/masked-text.tsx) | Highlights typed redaction placeholders and supported reference values. |
| [components/landing.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/landing.tsx) | Payment-security landing illustration, navigation, feature content and FAQ. |
| [components/mascot/mascot.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/mascot/mascot.tsx) | State-aware guide illustration and dismissible hints. |
| [components/shell/app-shell.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/shell/app-shell.tsx) | Desktop/sidebar and mobile shell, locale control and shared navigation. |
| [components/ui/accordion.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/accordion.tsx) | Expandable disclosure sections. Retained scaffold; outside active desk imports. |
| [components/ui/alert-dialog.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/alert-dialog.tsx) | Modal confirmation primitives. Retained scaffold; outside active desk imports. |
| [components/ui/alert.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/alert.tsx) | Status and alert presentation. Retained scaffold; outside active desk imports. |
| [components/ui/aspect-ratio.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/aspect-ratio.tsx) | Fixed aspect ratio container. Retained scaffold; outside active desk imports. |
| [components/ui/attachment.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/attachment.tsx) | Attachment presentation. Retained scaffold; outside active desk imports. |
| [components/ui/avatar.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/avatar.tsx) | Profile image and fallback. Retained scaffold; outside active desk imports. |
| [components/ui/badge.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/badge.tsx) | Compact status badges. Retained scaffold; outside active desk imports. |
| [components/ui/breadcrumb.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/breadcrumb.tsx) | Hierarchical navigation trail. Retained scaffold; outside active desk imports. |
| [components/ui/bubble.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/bubble.tsx) | Conversation bubble primitives. Retained scaffold; outside active desk imports. |
| [components/ui/button-group.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/button-group.tsx) | Grouped action layout. Retained scaffold; outside active desk imports. |
| [components/ui/button.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/button.tsx) | Styled action button. Retained scaffold; outside active desk imports. |
| [components/ui/calendar.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/calendar.tsx) | Calendar date selection. Retained scaffold; outside active desk imports. |
| [components/ui/card.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/card.tsx) | Card layout primitives. Retained scaffold; outside active desk imports. |
| [components/ui/carousel.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/carousel.tsx) | Carousel wrappers. Retained scaffold; outside active desk imports. |
| [components/ui/chart.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/chart.tsx) | Recharts presentation helpers. Retained scaffold; outside active desk imports. |
| [components/ui/checkbox.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/checkbox.tsx) | Checkbox input. Retained scaffold; outside active desk imports. |
| [components/ui/collapsible.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/collapsible.tsx) | Collapsible content container. Retained scaffold; outside active desk imports. |
| [components/ui/combobox.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/combobox.tsx) | Searchable option selection. Retained scaffold; outside active desk imports. |
| [components/ui/command.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/command.tsx) | Command palette primitives. Retained scaffold; outside active desk imports. |
| [components/ui/context-menu.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/context-menu.tsx) | Context action menu. Retained scaffold; outside active desk imports. |
| [components/ui/dialog.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/dialog.tsx) | Modal dialog primitives. Retained scaffold; outside active desk imports. |
| [components/ui/direction.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/direction.tsx) | Text-direction context. Retained scaffold; outside active desk imports. |
| [components/ui/drawer.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/drawer.tsx) | Drawer overlay. Retained scaffold; outside active desk imports. |
| [components/ui/dropdown-menu.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/dropdown-menu.tsx) | Dropdown action menu. Retained scaffold; outside active desk imports. |
| [components/ui/empty.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/empty.tsx) | Empty-state layout. Retained scaffold; outside active desk imports. |
| [components/ui/field.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/field.tsx) | Form field presentation. Retained scaffold; outside active desk imports. |
| [components/ui/form.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/form.tsx) | React Hook Form helpers. Retained scaffold; outside active desk imports. |
| [components/ui/hover-card.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/hover-card.tsx) | Hover preview card. Retained scaffold; outside active desk imports. |
| [components/ui/input-group.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/input-group.tsx) | Grouped input and adornments. Retained scaffold; outside active desk imports. |
| [components/ui/input-otp.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/input-otp.tsx) | One-time-code input presentation. Retained scaffold; outside active desk imports. |
| [components/ui/input.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/input.tsx) | Styled single-line input. Retained scaffold; outside active desk imports. |
| [components/ui/item.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/item.tsx) | List item layout. Retained scaffold; outside active desk imports. |
| [components/ui/kbd.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/kbd.tsx) | Keyboard shortcut label. Retained scaffold; outside active desk imports. |
| [components/ui/label.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/label.tsx) | Input label. Retained scaffold; outside active desk imports. |
| [components/ui/marker.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/marker.tsx) | Inline marker presentation. Retained scaffold; outside active desk imports. |
| [components/ui/menubar.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/menubar.tsx) | Menu bar primitives. Retained scaffold; outside active desk imports. |
| [components/ui/message-scroller.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/message-scroller.tsx) | Conversation scroll layout. Retained scaffold; outside active desk imports. |
| [components/ui/message.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/message.tsx) | Message layout primitives. Retained scaffold; outside active desk imports. |
| [components/ui/native-select.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/native-select.tsx) | Styled native select. Retained scaffold; outside active desk imports. |
| [components/ui/navigation-menu.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/navigation-menu.tsx) | Navigation menu primitives. Retained scaffold; outside active desk imports. |
| [components/ui/pagination.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/pagination.tsx) | Pagination controls. Retained scaffold; outside active desk imports. |
| [components/ui/popover.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/popover.tsx) | Anchored popover. Retained scaffold; outside active desk imports. |
| [components/ui/progress.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/progress.tsx) | Progress indication. Retained scaffold; outside active desk imports. |
| [components/ui/radio-group.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/radio-group.tsx) | Radio choice group. Retained scaffold; outside active desk imports. |
| [components/ui/resizable.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/resizable.tsx) | Resizable panel wrappers. Retained scaffold; outside active desk imports. |
| [components/ui/scroll-area.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/scroll-area.tsx) | Custom scroll area. Retained scaffold; outside active desk imports. |
| [components/ui/select.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/select.tsx) | Select primitives. Retained scaffold; outside active desk imports. |
| [components/ui/separator.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/separator.tsx) | Visual separator. Retained scaffold; outside active desk imports. |
| [components/ui/sheet.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/sheet.tsx) | Side-sheet overlay. Retained scaffold; outside active desk imports. |
| [components/ui/sidebar.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/sidebar.tsx) | Reusable sidebar system. Retained scaffold; outside active desk imports. |
| [components/ui/skeleton.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/skeleton.tsx) | Loading placeholders. Retained scaffold; outside active desk imports. |
| [components/ui/slider.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/slider.tsx) | Range input. Retained scaffold; outside active desk imports. |
| [components/ui/sonner.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/sonner.tsx) | Toast provider wrapper. Retained scaffold; outside active desk imports. |
| [components/ui/spinner.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/spinner.tsx) | Loading spinner. Retained scaffold; outside active desk imports. |
| [components/ui/switch.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/switch.tsx) | Toggle switch. Retained scaffold; outside active desk imports. |
| [components/ui/table.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/table.tsx) | Table primitives. Retained scaffold; outside active desk imports. |
| [components/ui/tabs.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/tabs.tsx) | Tabbed-content primitives. Retained scaffold; outside active desk imports. |
| [components/ui/textarea.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/textarea.tsx) | Styled multiline input. Retained scaffold; outside active desk imports. |
| [components/ui/toggle-group.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/toggle-group.tsx) | Grouped toggle controls. Retained scaffold; outside active desk imports. |
| [components/ui/toggle.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/toggle.tsx) | Single toggle control. Retained scaffold; outside active desk imports. |
| [components/ui/tooltip.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/ui/tooltip.tsx) | Tooltip presentation. Retained scaffold; outside active desk imports. |
| [components/views/benchmarks-view.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/views/benchmarks-view.tsx) | Checkpoint comparison descriptions without fabricated measurements. |
| [components/views/pipeline-view.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/views/pipeline-view.tsx) | Four-stage architecture explorer and exported research mixing configuration. |
| [components/views/policy-view.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/views/policy-view.tsx) | Searchable localized policy-source library. |
| [data/seeds/synthetic_cases.jsonl](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/data/seeds/synthetic_cases.jsonl) | Eighteen synthetic source/gold examples with sample IDs, family splits and provenance. |
| [data/triage.schema.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/data/triage.schema.json) | Portable strict eight-field payload schema used by research prompts and validators. |
| [db/index.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/db/index.ts) | Optional D1/Drizzle accessor that refuses a missing DB binding. |
| [db/schema.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/db/schema.ts) | Intentionally empty inactive database schema. |
| [docs/RESEARCH.md](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/docs/RESEARCH.md) | Optional toolkit, GPU workflow, model-evidence boundaries and artifact integrity runbook. |
| [docs/VERIFICATION.md](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/docs/VERIFICATION.md) | Dated implementation checks, repeatable HTTP verification and outstanding validation. |
| [drizzle/meta/_journal.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/drizzle/meta/_journal.json) | Retained Drizzle migration metadata; no operational customer-message schema. |
| [eslint.config.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/eslint.config.mjs) | Flat ESLint configuration for the repository. |
| [examples/d1/app/api/notes/route.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/examples/d1/app/api/notes/route.ts) | Opt-in notes GET/POST example outside the active app tree; its migration command is illustrative. |
| [examples/d1/db/schema.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/examples/d1/db/schema.ts) | Optional notes-table example, not a deployed ticket database. |
| [hooks/use-dictation.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/hooks/use-dictation.ts) | Browser speech recognition lifecycle, interim transcript, callback identity and teardown. |
| [hooks/use-mobile.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/hooks/use-mobile.ts) | Reusable responsive breakpoint hook for UI scaffolding. |
| [lib/api-guard.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/api-guard.ts) | Worker-level triage method, optional shared-key and rate-budget checks. |
| [lib/connector-context.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-context.ts) | Request-local AsyncLocalStorage holder for a trusted connector capability. |
| [lib/connector-contract.mts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-contract.mts) | Typed server-only connector context and invocation contract with explicit outcomes. |
| [lib/connector-errors.mts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-errors.mts) | Validates connector results and derives recovery actions without unsafe replay. |
| [lib/connector-preview.d.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-preview.d.ts) | Types for the local virtual connector-preview module and auxiliary binding. |
| [lib/connectors.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connectors.ts) | Creates the optional request-scoped connector facade. |
| [lib/content/mascot.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/content/mascot.ts) | Localized hint content and state-priority selection logic. |
| [lib/content/pipeline.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/content/pipeline.ts) | Stage explanations, status labels, implementation paths and six checkpoint descriptions. |
| [lib/content/scenarios.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/content/scenarios.ts) | Current localized six-scenario content consumed by the live desk. |
| [lib/engine.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/engine.ts) | Input and payload schemas, contextual masking, extraction, tiers, actions, reply and audit result. |
| [lib/format.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/format.ts) | Display formatting, currency, UTC date formatting and browser JSON download. |
| [lib/http.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/http.ts) | No-store errors, request IDs, body budgets, deadlines, cancellation and UTF-8 validation. |
| [lib/i18n/catalog.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/catalog.ts) | English/Hindi UI catalog, typed message keys, interpolation and translation. |
| [lib/i18n/locales.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/locales.ts) | UI/reply locale registry, validation and localized-text selection. |
| [lib/i18n/provider.tsx](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/provider.tsx) | React locale context; URL/storage subscriptions and document language updates. |
| [lib/i18n/replies.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/replies.ts) | Five complete customer-reply template bundles and placeholder filling. |
| [lib/nav.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/nav.ts) | Query-parameter view state and browser history subscriptions. |
| [lib/numbers.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/numbers.ts) | Same-width decimal digit normalization and currency-marked BigInt-paise parsing. |
| [lib/policy.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/policy.ts) | Dated policy version, six primary-source definitions and escalation note. |
| [lib/rate-limit.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rate-limit.ts) | Bounded per-isolate fixed-window counters, client identity and digest comparison. |
| [lib/rules/classification.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rules/classification.ts) | Ordered dispute signals, immediate negation guard and fraud-category predicate. |
| [lib/rules/language.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rules/language.ts) | Script/word-list language detection and language-specific signal data. |
| [lib/scenarios.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/scenarios.ts) | Older nonlocalized scenario array outside the active page import path. |
| [lib/strict-json.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/strict-json.ts) | Strict JSON syntax, decoded duplicate-key, finite-number and nesting-depth checks. |
| [lib/triage-api.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-api.ts) | Injectable route handler for parsing, input validation, engine execution and safe errors. |
| [lib/triage-client.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-client.ts) | Abortable HTTP request with deadline, structured failures and runtime result validation. |
| [lib/triage-reducer.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-reducer.ts) | Single desk state machine with full-input staleness, request IDs and temporary reveal. |
| [lib/triage-response.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-response.ts) | Runtime validator for every field consumed from the triage HTTP result. |
| [lib/utils.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/utils.ts) | Combines class names with clsx and Tailwind merge for reusable UI components. |
| [next.config.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/next.config.ts) | Strict React mode and response security headers in the Next-compatible integration. |
| [package-lock.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/package-lock.json) | Exact resolved npm dependency graph for reproducible installation. |
| [package.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/package.json) | Runtime versions, npm commands, optional dependencies and security overrides. |
| [phase1_curatorkit_pipeline.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase1_curatorkit_pipeline.py) | Local provenance/consistency curation with optional Presidio and actual CuratorKIT export. |
| [phase2_aligntune_train_and_merge.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py) | Plan, tokenizer adaptation, four training stages and verified weighted-delta merge. |
| [phase3_auditkit_eval.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase3_auditkit_eval.py) | Aligned recorded-prediction scoring, named baseline, paired bootstrap and optional AuditKIT. |
| [postcss.config.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/postcss.config.mjs) | Tailwind PostCSS integration. |
| [public/favicon.svg](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/public/favicon.svg) | Application favicon vector asset. |
| [requirements-audit.txt](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/requirements-audit.txt) | Pinned AuditKIT Git snapshot and optional ChrF dependency. |
| [requirements-curation.txt](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/requirements-curation.txt) | Pinned CuratorKIT snapshot and optional Presidio analyzer/anonymizer. |
| [requirements-training.txt](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/requirements-training.txt) | Pinned AlignTune training environment entry point. |
| [research/__init__.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/__init__.py) | Python package marker for shared contracts and tests. |
| [research/artifacts.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py) | Streaming hashes, checkpoint manifests, path bounds and inference provenance checks. |
| [research/common.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py) | Shared payload validator, strict JSON, rewards, prompts, atomic JSONL and Node bridge. |
| [research/test_integrity.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/test_integrity.py) | Artifact/path/write/baseline/revision integrity regressions. |
| [research/test_pipeline.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/test_pipeline.py) | Core research schema, reward, curation, split and evaluation regressions. |
| [research/toolkit_revisions.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/toolkit_revisions.json) | Source repositories and immutable Git revisions for the three toolkits. |
| [scripts/build-verified.sh](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/build-verified.sh) | Bounded managed build with environment preparation and GNU timeout. |
| [scripts/connector-preview/connector-preview-session.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/connector-preview/connector-preview-session.mjs) | Local short-lived connector driver session and JSON-RPC service. |
| [scripts/connector-preview/host-binding.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/connector-preview/host-binding.mjs) | Host-side adapter for optional local connector invocation. |
| [scripts/connector-preview/protocol.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/connector-preview/protocol.mjs) | Zod schemas for connector grants, sessions and driver messages. |
| [scripts/connector-preview/worker.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/connector-preview/worker.mjs) | Auxiliary local Worker implementing the preview connector binding. |
| [scripts/execution-profile.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/execution-profile.mjs) | Selects portable or managed-linux execution from ignored local state. |
| [scripts/generate_predictions.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/generate_predictions.py) | Actual unrepaired two-call checkpoint inference and provenance manifest. |
| [scripts/install-ci.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/install-ci.mjs) | Node installer entry selecting portable or managed dependency installation. |
| [scripts/install-ci.sh](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/install-ci.sh) | Managed dependency installation wrapper. |
| [scripts/install-pnpm.sh](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/install-pnpm.sh) | Support wrapper for the retained managed pnpm installation path. |
| [scripts/npm-install.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/npm-install.mjs) | Controlled npm child process and installation support. |
| [scripts/pnpm-install.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/pnpm-install.mjs) | Controlled pnpm child process and installation support. |
| [scripts/run-framework.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/run-framework.mjs) | Selects development/build CLI based on execution profile. |
| [scripts/sites-env.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/sites-env.mjs) | Project-root and writable tool-state setup for Node commands. |
| [scripts/sites-env.sh](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/sites-env.sh) | Shell environment wrapper for managed execution. |
| [scripts/smoke-http.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/smoke-http.mjs) | Synthetic local-only built-Worker integration checks, including authentication and bursts. |
| [scripts/tool-environment.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/tool-environment.mjs) | Shared environment defaults for local tool registries, logs and telemetry settings. |
| [scripts/triage.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/triage.mjs) | JSONL stdin/stdout bridge from Python to the TypeScript engine. |
| [scripts/verify_research.py](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/verify_research.py) | Clearly labelled valid/unsafe scorer fixtures and optional real AuditKIT execution. |
| [scripts/vite/connector-preview-plugin.mjs](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/vite/connector-preview-plugin.mjs) | Vite local middleware and virtual module for connector preview sessions. |
| [scripts/vite/sites-vite-plugin.LICENSE](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/vite/sites-vite-plugin.LICENSE) | Licence notice for the retained Sites integration source. |
| [scripts/vite/sites-vite-plugin.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/vite/sites-vite-plugin.ts) | Sites auth/headers/assets integration for Vite development and Worker packaging. |
| [tests/api-triage.test.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/tests/api-triage.test.ts) | Basic triage API success, error, media, input-bound and request-ID regressions. |
| [tests/backend-hardening.test.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/tests/backend-hardening.test.ts) | Streaming, strict JSON, privacy-safe failure, auth, identity and quota checks. |
| [tests/engine.test.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/tests/engine.test.ts) | Rules, numerical precision, PII, reference provenance and policy-boundary checks. |
| [tests/i18n.test.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/tests/i18n.test.ts) | Catalog/template completeness, language choice and policy rails in each bundle. |
| [tests/triage-client.test.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/tests/triage-client.test.ts) | Validated response contract, network timeout, retry metadata and cancellation. |
| [tests/triage-reducer.test.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/tests/triage-reducer.test.ts) | Input snapshots, races, scenario resets, stale assessments and reveal lifecycle. |
| [tsconfig.json](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/tsconfig.json) | Strict TypeScript, ES2022, bundler resolution, aliases and Worker environment types. |
| [vendor/shadcn-tailwind-4.13.0.LICENSE.md](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/vendor/shadcn-tailwind-4.13.0.LICENSE.md) | Licence notice accompanying the retained component stylesheet. |
| [vendor/shadcn-tailwind-4.13.0.css](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/vendor/shadcn-tailwind-4.13.0.css) | Retained component design tokens and utility stylesheet. |
| [vite.config.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/vite.config.ts) | Vinext, Sites, Cloudflare and local connector-preview build configuration. |
| [worker/index.ts](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/worker/index.ts) | Custom fetch entry: triage guard, request-scoped connector binding and framework delegation. |

## Appendix B Main function index

This index points to the named implementation functions at the described commit. It includes internal helpers important to the runtime and all top-level research functions. Types, constant catalogs and generic scaffold exports remain discoverable through their file entries.

| File | Function | Locator |
| --- | --- | --- |
| `app/api/health/route.ts` | `GET` | [L2](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/api/health/route.ts#L2) |
| `app/api/triage/route.ts` | `POST` | [L3](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/api/triage/route.ts#L3) |
| `app/error.tsx` | `Error` | [L4](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/error.tsx#L4) |
| `app/layout.tsx` | `RootLayout` | [L20](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/layout.tsx#L20) |
| `app/not-found.tsx` | `NotFound` | [L3](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/not-found.tsx#L3) |
| `app/page.tsx` | `Page` | [L54](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/app/page.tsx#L54) |
| `components/connector-error.tsx` | `ConnectorError` | [L6](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/connector-error.tsx#L6) |
| `components/desk/composer.tsx` | `Composer` | [L32](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/composer.tsx#L32) |
| `components/desk/engine-panel.tsx` | `Liability` | [L27](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/engine-panel.tsx#L27) |
| `components/desk/engine-panel.tsx` | `EnginePanel` | [L74](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/engine-panel.tsx#L74) |
| `components/desk/intake-panel.tsx` | `IntakePanel` | [L18](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/intake-panel.tsx#L18) |
| `components/desk/json-view.tsx` | `classifyToken` | [L13](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/json-view.tsx#L13) |
| `components/desk/json-view.tsx` | `tokenize` | [L22](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/desk/json-view.tsx#L22) |
| `components/landing.tsx` | `SecurityIllustration` | [L16](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/landing.tsx#L16) |
| `components/landing.tsx` | `Landing` | [L126](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/landing.tsx#L126) |
| `components/mascot/mascot.tsx` | `Mascot` | [L42](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/mascot/mascot.tsx#L42) |
| `components/mascot/mascot.tsx` | `MascotBody` | [L70](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/mascot/mascot.tsx#L70) |
| `components/shell/app-shell.tsx` | `LanguageSwitcher` | [L30](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/shell/app-shell.tsx#L30) |
| `components/shell/app-shell.tsx` | `AppShell` | [L53](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/shell/app-shell.tsx#L53) |
| `components/views/benchmarks-view.tsx` | `BenchmarksView` | [L15](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/views/benchmarks-view.tsx#L15) |
| `components/views/pipeline-view.tsx` | `PipelineView` | [L25](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/views/pipeline-view.tsx#L25) |
| `components/views/policy-view.tsx` | `PolicyView` | [L8](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/components/views/policy-view.tsx#L8) |
| `hooks/use-dictation.ts` | `getRecognitionCtor` | [L51](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/hooks/use-dictation.ts#L51) |
| `hooks/use-dictation.ts` | `useDictation` | [L77](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/hooks/use-dictation.ts#L77) |
| `hooks/use-mobile.ts` | `useIsMobile` | [L5](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/hooks/use-mobile.ts#L5) |
| `lib/api-guard.ts` | `guardTriageApi` | [L8](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/api-guard.ts#L8) |
| `lib/connector-context.ts` | `runWithConnectorBinding` | [L8](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-context.ts#L8) |
| `lib/connector-context.ts` | `getConnectorBinding` | [L15](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-context.ts#L15) |
| `lib/connector-contract.mts` | `createConnectors` | [L76](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-contract.mts#L76) |
| `lib/connector-errors.mts` | `connectorResponse` | [L4](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-errors.mts#L4) |
| `lib/connector-errors.mts` | `connectorErrorRecovery` | [L70](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connector-errors.mts#L70) |
| `lib/connectors.ts` | `connectorsForRequest` | [L5](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/connectors.ts#L5) |
| `lib/content/mascot.ts` | `mascotHintFor` | [L143](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/content/mascot.ts#L143) |
| `lib/engine.ts` | `isCalendarDate` | [L38](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/engine.ts#L38) |
| `lib/engine.ts` | `redactPII` | [L141](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/engine.ts#L141) |
| `lib/engine.ts` | `policyCheck` | [L248](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/engine.ts#L248) |
| `lib/engine.ts` | `isFraud` | [L264](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/engine.ts#L264) |
| `lib/engine.ts` | `draftReply` | [L268](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/engine.ts#L268) |
| `lib/engine.ts` | `triage` | [L340](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/engine.ts#L340) |
| `lib/format.ts` | `formatDate` | [L18](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/format.ts#L18) |
| `lib/format.ts` | `download` | [L30](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/format.ts#L30) |
| `lib/http.ts` | `apiError` | [L14](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/http.ts#L14) |
| `lib/http.ts` | `BodyReadError` | [L26](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/http.ts#L26) |
| `lib/http.ts` | `readBoundedText` | [L34](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/http.ts#L34) |
| `lib/i18n/catalog.ts` | `interpolate` | [L664](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/catalog.ts#L664) |
| `lib/i18n/catalog.ts` | `translate` | [L671](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/catalog.ts#L671) |
| `lib/i18n/locales.ts` | `isUiLocale` | [L32](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/locales.ts#L32) |
| `lib/i18n/locales.ts` | `uiLocale` | [L39](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/locales.ts#L39) |
| `lib/i18n/locales.ts` | `replyLanguage` | [L87](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/locales.ts#L87) |
| `lib/i18n/locales.ts` | `isReplyLanguage` | [L94](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/locales.ts#L94) |
| `lib/i18n/locales.ts` | `pick` | [L107](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/locales.ts#L107) |
| `lib/i18n/provider.tsx` | `subscribe` | [L33](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/provider.tsx#L33) |
| `lib/i18n/provider.tsx` | `getSnapshot` | [L44](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/provider.tsx#L44) |
| `lib/i18n/provider.tsx` | `I18nProvider` | [L59](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/provider.tsx#L59) |
| `lib/i18n/provider.tsx` | `useI18n` | [L93](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/provider.tsx#L93) |
| `lib/i18n/replies.ts` | `fill` | [L315](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/i18n/replies.ts#L315) |
| `lib/nav.ts` | `readView` | [L8](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/nav.ts#L8) |
| `lib/nav.ts` | `useUrlView` | [L18](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/nav.ts#L18) |
| `lib/numbers.ts` | `asciiDigits` | [L6](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/numbers.ts#L6) |
| `lib/numbers.ts` | `findAmounts` | [L16](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/numbers.ts#L16) |
| `lib/rate-limit.ts` | `createRateLimiter` | [L8](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rate-limit.ts#L8) |
| `lib/rate-limit.ts` | `clientKey` | [L61](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rate-limit.ts#L61) |
| `lib/rate-limit.ts` | `secretsMatch` | [L70](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rate-limit.ts#L70) |
| `lib/rules/classification.ts` | `isFraudCategory` | [L57](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rules/classification.ts#L57) |
| `lib/rules/classification.ts` | `positive` | [L61](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rules/classification.ts#L61) |
| `lib/rules/classification.ts` | `classify` | [L76](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rules/classification.ts#L76) |
| `lib/rules/language.ts` | `containsWord` | [L93](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rules/language.ts#L93) |
| `lib/rules/language.ts` | `detectLanguage` | [L110](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/rules/language.ts#L110) |
| `lib/strict-json.ts` | `parseStrictJson` | [L2](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/strict-json.ts#L2) |
| `lib/triage-api.ts` | `createTriageHandler` | [L17](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-api.ts#L17) |
| `lib/triage-client.ts` | `TriageClientError` | [L14](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-client.ts#L14) |
| `lib/triage-client.ts` | `requestTriage` | [L29](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-client.ts#L29) |
| `lib/triage-reducer.ts` | `inputsMatch` | [L35](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-reducer.ts#L35) |
| `lib/triage-reducer.ts` | `initialTriageState` | [L47](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-reducer.ts#L47) |
| `lib/triage-reducer.ts` | `isStale` | [L64](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-reducer.ts#L64) |
| `lib/triage-reducer.ts` | `triageReducer` | [L66](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/triage-reducer.ts#L66) |
| `lib/utils.ts` | `cn` | [L4](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/lib/utils.ts#L4) |
| `phase1_curatorkit_pipeline.py` | `presidio_scrub` | [L15](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase1_curatorkit_pipeline.py#L15) |
| `phase1_curatorkit_pipeline.py` | `curate` | [L39](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase1_curatorkit_pipeline.py#L39) |
| `phase1_curatorkit_pipeline.py` | `main` | [L129](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase1_curatorkit_pipeline.py#L129) |
| `phase2_aligntune_train_and_merge.py` | `require_gpu` | [L18](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L18) |
| `phase2_aligntune_train_and_merge.py` | `package_versions` | [L24](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L24) |
| `phase2_aligntune_train_and_merge.py` | `identity` | [L33](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L33) |
| `phase2_aligntune_train_and_merge.py` | `materialize_base` | [L58](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L58) |
| `phase2_aligntune_train_and_merge.py` | `resolve_shared_base` | [L64](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L64) |
| `phase2_aligntune_train_and_merge.py` | `assert_tokenizer_matches_model` | [L74](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L74) |
| `phase2_aligntune_train_and_merge.py` | `check_data` | [L84](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L84) |
| `phase2_aligntune_train_and_merge.py` | `register_reward` | [L103](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L103) |
| `phase2_aligntune_train_and_merge.py` | `write_manifest` | [L114](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L114) |
| `phase2_aligntune_train_and_merge.py` | `read_manifest` | [L117](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L117) |
| `phase2_aligntune_train_and_merge.py` | `train` | [L121](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L121) |
| `phase2_aligntune_train_and_merge.py` | `adapt_tokenizer` | [L152](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L152) |
| `phase2_aligntune_train_and_merge.py` | `merge` | [L206](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L206) |
| `phase2_aligntune_train_and_merge.py` | `main` | [L241](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase2_aligntune_train_and_merge.py#L241) |
| `phase3_auditkit_eval.py` | `score_prediction` | [L18](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase3_auditkit_eval.py#L18) |
| `phase3_auditkit_eval.py` | `align_predictions` | [L50](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase3_auditkit_eval.py#L50) |
| `phase3_auditkit_eval.py` | `paired_bootstrap` | [L65](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase3_auditkit_eval.py#L65) |
| `phase3_auditkit_eval.py` | `auditkit_evaluate` | [L82](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase3_auditkit_eval.py#L82) |
| `phase3_auditkit_eval.py` | `evaluate` | [L99](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase3_auditkit_eval.py#L99) |
| `phase3_auditkit_eval.py` | `main` | [L129](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/phase3_auditkit_eval.py#L129) |
| `research/artifacts.py` | `file_digest` | [L6](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py#L6) |
| `research/artifacts.py` | `adapter_fingerprints` | [L12](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py#L12) |
| `research/artifacts.py` | `write_adapter_manifest` | [L19](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py#L19) |
| `research/artifacts.py` | `read_adapter_manifest` | [L27](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py#L27) |
| `research/artifacts.py` | `resolve_adapter` | [L33](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py#L33) |
| `research/artifacts.py` | `safe_dataset_file` | [L51](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py#L51) |
| `research/artifacts.py` | `verify_prediction_manifest` | [L58](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/artifacts.py#L58) |
| `research/common.py` | `read_jsonl` | [L21](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L21) |
| `research/common.py` | `write_jsonl` | [L25](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L25) |
| `research/common.py` | `digest` | [L41](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L41) |
| `research/common.py` | `strict_json` | [L45](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L45) |
| `research/common.py` | `schema_valid` | [L59](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L59) |
| `research/common.py` | `payload_matches` | [L77](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L77) |
| `research/common.py` | `engine_batch` | [L97](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L97) |
| `research/common.py` | `no_guarantee` | [L106](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L106) |
| `research/common.py` | `required_rails` | [L110](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L110) |
| `research/common.py` | `extraction_reward` | [L115](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L115) |
| `research/common.py` | `split_response` | [L129](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L129) |
| `research/common.py` | `prompt_for` | [L138](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/research/common.py#L138) |
| `scripts/generate_predictions.py` | `main` | [L15](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/generate_predictions.py#L15) |
| `scripts/verify_research.py` | `main` | [L10](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/scripts/verify_research.py#L10) |
| `worker/index.ts` | `worker` | [L6](https://github.com/vishal88736/suraksha-merge/blob/541d5b6ca945d1ace3d53b9f66b4c80dd3cb6fd6/worker/index.ts#L6) |
