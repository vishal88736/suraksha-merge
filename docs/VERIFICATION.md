# Verification record

Implementation check on 10 November 2026. These are local implementation and fixture checks; current GitHub Actions status is recorded separately by the commit's Actions run.

| Surface                           | Observed result            | Scope                                                                                                                                        |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                        | Pass                       | `npm run check`                                                                                                                              |
| App regressions                   | 87 passed                  | API, financial-policy rules, exact amounts, contextual PII, locale coverage, client contracts, request races and stale-result handling       |
| Research regressions              | 24 passed                  | Curation, strict rewards, split isolation, paired bootstrap, checkpoint resolution, hashes, dataset paths and pinned revision loading        |
| Dependency audit                  | Zero known vulnerabilities | `npm audit`; production and development dependency graph at the verification date                                                            |
| Production build                  | Pass                       | Vinext 1.4.4 / Vite 8 / React 19.3 Worker build                                                                                              |
| Built Worker HTTP integration     | 12 checks passed           | 40 synthetic HTTP requests; HTML routes, health, key enforcement, rate limit, Indic budget, PII, malformed JSON, dates and size/media limits |
| CuratorKIT 0.1.21                 | Pass                       | Actual schema/clean/exact-dedup/Alpaca export over 20 sanitized training records                                                             |
| AuditKIT 1.1.6                    | Pass                       | Actual custom scorers over five valid and five unsafe fixtures, labelled `SCORER_FIXTURE_VERIFICATION`                                       |
| GPU/model training                | Not run                    | NVIDIA driver unavailable; no model weights downloaded                                                                                       |
| Presidio                          | Not run                    | Optional integration needs the configured NLP model                                                                                          |
| Browser visual/interaction review | Unverified                 | Browser-control tools are unavailable in this session; successful HTML responses do not establish browser behavior                           |
| Bank/NPCI action                  | None                       | Decision-support draft only                                                                                                                  |

The HTTP check is repeatable against a fresh local built Worker. Its burst check deliberately uses the local rate budget. CI starts an isolated Worker before running it:

```bash
npm run build
npm run start -- --port 8791 --var TRIAGE_API_KEY:local-smoke-fixture-only
# In another terminal; this value is a synthetic test key:
TRIAGE_SMOKE_API_KEY=local-smoke-fixture-only node scripts/smoke-http.mjs http://127.0.0.1:8791
```

The rate limiter is bounded and local to a Worker isolate. Distributed quota enforcement and operational bank integrations remain deployment decisions. The runtime redactor covers tested contextual patterns; it is not a general guarantee of detecting every identity format.

No measured six-checkpoint model comparison, regional-language human empathy study, inference-cost result or production compliance certification is claimed. Source-pinned GPU commands still need execution and validation on the training host.

## Public-source curation, 12 November 2026

The [data-curation record](DATA_CURATION.md) covers the current run. Downloaded eight pinned payload files (36,868 rows); ran actual CuratorKIT normalization, schema, exact/MinHash deduplication, Alpaca and DPO exports; retained 934 unreviewed cases with grouped 758/84/92 splits. Independent artifact checks cover schema, provenance, masking idempotence, numeric grounding, preference patterns and split/benchmark exclusion. All 19 core JSONL files were byte-identical on a cached rerun; toolkit/run timestamps are excluded.

Current local checks: 45 Python regressions (including actual CuratorKIT tests), 89 application regressions, TypeScript and production build passed. The public-data workflow does not execute AuditKIT scorer fixtures, model benchmarking or AlignTune training. No Presidio NLP model or target tokenizer was run. Human review count remains zero, and default training is blocked. Earlier fixture observations above retain their original date and scope.
