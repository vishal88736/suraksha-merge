import { z } from "zod";
import {
  inputSchema,
  isFraud,
  payloadSchema,
  policyCheck,
  triage,
  type ModelAudit,
  type ModelInfo,
  type Payload,
  type TriageInput,
  type TriageResult,
} from "./engine.ts";
import { asciiDigits, findAmounts } from "./numbers.ts";
import { detectLanguage } from "./rules/language.ts";
import { MODEL_LANGUAGES } from "./i18n/locales.ts";
import { parseStrictJson } from "./strict-json.ts";
import type { ModelConfig } from "./model-config.ts";

const MAX_RAW_CHARS = 8_000;

const serverResponse = z.object({
  raw: z.string().max(MAX_RAW_CHARS),
  reply: z.string().max(MAX_RAW_CHARS).nullable().optional(),
  latency_ms: z.number().finite().nonnegative(),
  model: z.object({
    base_model: z.string().max(200),
    base_revision: z.string().regex(/^[0-9a-f]{40}$/),
    adapter: z.string().max(500).nullable(),
    adapter_sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    quantization: z.string().max(50),
    unreviewed_pilot: z.boolean().default(false),
  }),
});

type Fetch = typeof fetch;

const TECHNICAL_TIER: Partial<Record<Payload["dispute_category"], string>> = {
  P2M_CONFIRMATION_FAILURE: "TECHNICAL_T_PLUS_5",
  P2P_BENEFICIARY_NOT_CREDITED: "TECHNICAL_T_PLUS_1",
};
// A liability conclusion beyond "pending" depends on operator-verified facts
// (responsibility, reporting delay), which the rules engine evaluates.
const EVIDENCE_TIERS = new Set([
  "ZERO_LIABILITY_ELIGIBLE",
  "LIMITED_LIABILITY_ELIGIBLE",
  "BANK_POLICY_REVIEW",
  "CUSTOMER_NEGLIGENCE_REVIEW",
]);
const FRAUD_RAILS = ["CONTACT_BANK_PSP", "CALL_1930", "REPORT_CYBERCRIME"];
const PANIC_RANK = { LOW: 0, MEDIUM: 1, HIGH_CRITICAL: 2 } as const;
type PolicyFromRules = NonNullable<
  Extract<ModelAudit, { status: "used" }>["policy_from_rules"]
>;

/**
 * Accept a model payload only if it is strict, schema-valid JSON whose facts
 * are grounded in the customer's message and whose policy conclusions do not
 * exceed what the verified operator context supports. No repairs are applied:
 * a prefix, code fence or misspelled key is a rejection, not a fix-up.
 */
export function validateModelPayload(
  raw: string,
  input: z.infer<typeof inputSchema>,
  rules: TriageResult,
): { ok: true; payload: Payload } | { ok: false; reasons: string[] } {
  let json: unknown;
  try {
    json = parseStrictJson(raw.trim());
  } catch {
    return { ok: false, reasons: ["not_strict_json"] };
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reasons: ["schema_invalid"] };
  const p = parsed.data;
  const reasons: string[] = [];

  const anchors = new Set(rules.privacy.anchors.map((a) => a.replacement));
  if (p.utr_number !== null && !anchors.has(p.utr_number))
    reasons.push("utr_not_grounded");
  // Occurring in the message is not enough: with several references the
  // transaction is ambiguous, and choosing one is a guess.
  if (p.utr_number !== null && anchors.size > 1) reasons.push("utr_ambiguous");

  const amounts = findAmounts(input.message);
  const values = new Set(amounts.hits.map((h) => h.value));
  if (
    p.amount_inr !== null &&
    (amounts.invalid || !values.has(p.amount_inr))
  )
    reasons.push("amount_not_grounded");
  if (p.amount_inr !== null && values.size > 1) reasons.push("amount_ambiguous");

  if (
    p.reporting_delay_working_days !== null &&
    p.reporting_delay_working_days !==
      rules.payload.reporting_delay_working_days
  )
    reasons.push("reporting_delay_not_grounded");

  if (input.language !== "auto" && p.detected_language !== input.language)
    reasons.push("language_conflicts_with_operator");
  // The reply is written in the detected language, so it must be the
  // language the message is actually in.
  if (
    input.language === "auto" &&
    p.detected_language !== rules.payload.detected_language
  )
    reasons.push("language_not_grounded");

  // The rules' keyword evidence is precise but narrow: on unfamiliar wording
  // they fall back to NEEDS_INFORMATION, and when they do name a category it
  // has been right (data/challenge, reviewed benchmark). So the model adds
  // recall: it may name the category when the rules cannot, but it may not
  // contradict a category the rules found.
  const rulesCategory = rules.payload.dispute_category;
  if (rulesCategory !== "NEEDS_INFORMATION" && p.dispute_category !== rulesCategory) {
    if (p.dispute_category === "NEEDS_INFORMATION")
      reasons.push("model_less_specific_than_rules");
    else reasons.push("model_contradicts_rules_category");
    if (isFraud(rulesCategory) && !isFraud(p.dispute_category))
      reasons.push("model_misses_fraud_signal");
  }

  const tier = p.rbi_liability_tier;
  const technical = TECHNICAL_TIER[p.dispute_category];
  if (rules.sla.policy_revalidation_required && tier !== "PENDING_VERIFICATION")
    reasons.push("tier_requires_policy_revalidation");
  else if (tier.startsWith("TECHNICAL_") && tier !== technical)
    reasons.push("tier_inconsistent_with_category");
  else if (
    EVIDENCE_TIERS.has(tier) &&
    // The tier the policy gives for the model's own category, so a category
    // the keyword rules missed is not judged by their NEEDS_INFORMATION tier.
    tier !==
      (p.dispute_category === rules.payload.dispute_category
        ? rules.payload.rbi_liability_tier
        : triage(input, { category: p.dispute_category }).payload.rbi_liability_tier)
  )
    reasons.push("tier_not_supported_by_operator_context");

  if (
    isFraud(p.dispute_category) &&
    !FRAUD_RAILS.every((a) => p.mandatory_actions.includes(a as never))
  )
    reasons.push("fraud_rails_missing");
  if (p.utr_number === null && !p.mandatory_actions.includes("REQUEST_UTR"))
    reasons.push("missing_request_utr");

  return reasons.length ? { ok: false, reasons } : { ok: true, payload: p };
}

const ALLOWED_DOMAINS = new Set(["cybercrime.gov.in", "cms.rbi.org.in"]);

/**
 * Check a model-written customer reply. It must keep every promise and rail
 * rule of the templates, be in the payload's language, and mention no
 * reference, amount, link or phone number the message does not support.
 * On success the text is split into the desk's introduction/steps/escalation.
 */
export function validateModelReply(
  text: string,
  payload: Payload,
  message: string,
  compensation: number | null,
):
  | { ok: true; reply: { introduction: string; steps: string[]; escalation: string; text: string } }
  | { ok: false; reasons: string[] } {
  const reply = text.trim();
  const reasons: string[] = [];
  if (reply.length < 40) reasons.push("reply_too_short");
  if (reply.length > 3000) reasons.push("reply_too_long");
  const policy = policyCheck(reply, payload);
  if (!policy.no_unauthorized_promises) reasons.push("reply_promise");
  if (!policy.fraud_rails_present) reasons.push("reply_missing_fraud_rails");
  if (detectLanguage(reply) !== payload.detected_language) reasons.push("reply_wrong_language");
  // The reply must give the advice for this category: its markers present,
  // another category's markers absent (the markers stay Latin in every language).
  const category = payload.dispute_category;
  const technical = category === "P2P_BENEFICIARY_NOT_CREDITED" || category === "P2M_CONFIRMATION_FAILURE";
  const required =
    category === "P2P_BENEFICIARY_NOT_CREDITED" ? /T\+1\b/ :
    category === "P2M_CONFIRMATION_FAILURE" ? /T\+5\b/ :
    category === "VOLUNTARY_WRONG_VPA_TRANSFER" ? /VPA|wrong-beneficiary/i :
    category === "NEEDS_INFORMATION" ? /UTR|RRN/ : null;
  if (
    (required && !required.test(reply)) ||
    (!technical && /T\+[15]\b/.test(reply)) ||
    (category !== "VOLUNTARY_WRONG_VPA_TRANSFER" && /wrong-beneficiary|galat VPA|गलत VPA|wrong VPA/i.test(reply))
  )
    reasons.push("reply_inconsistent_with_category");
  const digits = asciiDigits(reply);
  for (const ref of digits.match(/(?<!\d)\d{12}(?!\d)/g) ?? [])
    if (ref !== payload.utr_number) reasons.push("reply_ungrounded_reference");
  const allowedAmounts = new Set([
    100,
    ...(compensation ? [compensation] : []),
    ...findAmounts(message).hits.map((h) => h.value),
  ]);
  if (findAmounts(reply).hits.some((h) => !allowedAmounts.has(h.value)))
    reasons.push("reply_ungrounded_amount");
  for (const domain of reply.match(/\b(?:[a-z0-9-]+\.)+(?:in|com|org|net|gov|co|io|app|xyz)\b/gi) ?? [])
    if (!ALLOWED_DOMAINS.has(domain.toLowerCase())) reasons.push("reply_unknown_link");
  if (/(?<!\d)(?:\+?91[ -]?)?[6-9](?:[ -]?\d){9}(?!\d)/.test(digits)) reasons.push("reply_contact_number");
  if (reasons.length) return { ok: false, reasons: [...new Set(reasons)] };
  return { ok: true, reply: splitReply(reply) };
}

/** The desk's layout: an opening paragraph, numbered steps, a closing paragraph. */
function splitReply(text: string) {
  const reply = text.trim();
  const paragraphs = reply.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const isStep = (p: string) => /^\d+[.)]\s/.test(p);
  const steps = paragraphs.filter(isStep).map((p) => p.replace(/^\d+[.)]\s*/, ""));
  const prose = paragraphs.filter((p) => !isStep(p));
  return {
    introduction: prose[0] ?? "",
    steps,
    escalation: prose.length > 1 ? prose.slice(1).join("\n\n") : "",
    text: reply,
  };
}

/** The model receives the same prompt fields used in training: the redacted message and operator context. */
function operatorContext(raw: TriageInput) {
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      ([key]) => key !== "message",
    ),
  );
}

async function callModel(
  config: ModelConfig,
  sanitized: string,
  context: Record<string, unknown>,
  fetchImpl: Fetch,
  task: "schema" | "reply" = "schema",
  timeoutMs: number = config.timeoutMs,
  sample = false,
) {
  const response = await fetchImpl(`${config.url}/v1/triage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      // The server drops queued work it could not start before this budget.
      "x-suraksha-deadline-ms": String(timeoutMs),
    },
    body: JSON.stringify({
      message: sanitized,
      context,
      ...(task === "reply" ? { task } : {}),
      ...(sample ? { sample } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 503) throw new Error("model_busy");
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  const text = await response.text();
  if (text.length > MAX_RAW_CHARS * 2) throw new Error("model_response_too_large");
  return serverResponse.parse(JSON.parse(text));
}

/** The least time worth giving the model to write a reply. */
const MIN_REPLY_MS = 3_000;

async function modelReply(
  config: ModelConfig,
  sanitized: string,
  raw: TriageInput,
  fetchImpl: Fetch,
  started: number,
): Promise<{ text: string } | { reason: string }> {
  const remaining = config.timeoutMs - (Date.now() - started);
  if (remaining < MIN_REPLY_MS) return { reason: "reply_no_time" };
  try {
    const response = await callModel(config, sanitized, operatorContext(raw), fetchImpl, "reply", remaining);
    return response.reply ? { text: response.reply } : { reason: "reply_not_generated" };
  } catch (error) {
    return {
      reason: error instanceof Error && error.name === "TimeoutError" ? "reply_timeout" : "reply_not_generated",
    };
  }
}

/** The model could not produce an answer at all (down, busy, or invalid output twice). */
export class ModelUnavailableError extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`model_unavailable: ${reasons.join(", ")}`);
    this.name = "ModelUnavailableError";
    this.reasons = reasons;
  }
}

function modelError(error: unknown): string {
  return error instanceof Error && error.name === "TimeoutError"
    ? "model_timeout"
    : error instanceof Error && (error.message.startsWith("model_http_") || error.message === "model_busy")
      ? error.message
      : "model_unavailable";
}

/**
 * Model authority: the model writes the whole answer, the payload and the
 * customer reply. Nothing is replaced by rules or templates. Each output is
 * checked; a failed check gets one sampled retry, and if the retry fails too
 * the model's answer is still shown, flagged for human review with every
 * failed check listed. Only privacy masking runs before the model.
 */
async function triageModelAuthority(
  raw: TriageInput,
  input: z.infer<typeof inputSchema>,
  rules: TriageResult,
  config: ModelConfig,
  fetchImpl: Fetch,
): Promise<TriageResult> {
  const started = Date.now();
  const context = operatorContext(raw);
  const remaining = () => config.timeoutMs - (Date.now() - started);
  const languageFlags = MODEL_LANGUAGES.includes(rules.payload.detected_language)
    ? []
    : ["language_outside_model_training"];

  // 1. The payload: greedy first, one sampled retry if a check fails.
  type Attempt = { payload: Payload | null; reasons: string[] };
  let best: Attempt | null = null;
  let model: ModelInfo | null = null;
  let latency = 0;
  let payloadAttempts = 0;
  const errors: string[] = [];
  for (const sample of [false, true]) {
    if (sample && remaining() < MIN_REPLY_MS) break;
    payloadAttempts++;
    let response: z.infer<typeof serverResponse>;
    try {
      response = await callModel(config, rules.privacy.sanitized, context, fetchImpl, "schema", remaining(), sample);
    } catch (error) {
      errors.push(modelError(error));
      continue;
    }
    model = response.model;
    latency += response.latency_ms;
    const checked = validateModelPayload(response.raw, input, rules);
    const attempt: Attempt = checked.ok
      ? { payload: checked.payload, reasons: [] }
      : (() => {
          // A schema-valid answer is kept even when checks fail: it is shown
          // flagged. Only unparseable output cannot be shown at all.
          try {
            const parsed = payloadSchema.safeParse(parseStrictJson(response.raw.trim()));
            return { payload: parsed.success ? parsed.data : null, reasons: checked.reasons };
          } catch {
            return { payload: null, reasons: checked.reasons };
          }
        })();
    if (!best || (attempt.payload && (!best.payload || attempt.reasons.length < best.reasons.length)))
      best = attempt;
    if (attempt.payload && !attempt.reasons.length) break;
  }
  if (!best?.payload || !model)
    throw new ModelUnavailableError(best ? best.reasons : errors.length ? [...new Set(errors)] : ["model_unavailable"]);
  const payload = best.payload;
  const payloadFlags = [...languageFlags, ...best.reasons];

  // Facts derived from the model's own payload (due date, compensation,
  // evidence spans); the template reply this builds is discarded below.
  const derived = triage(raw, { payload, model: { status: "used", model, latency_ms: latency } });

  // 2. The reply: greedy first, one sampled retry if a check fails. Every
  // reply training row named its language, so the reply request names the
  // language the model itself detected (the operator's choice, if set).
  const replyContext = { ...context, language: input.language === "auto" ? payload.detected_language : input.language };
  let replyText: string | null = null;
  let replyFlags: string[] = [];
  let replyAttempts = 0;
  for (const sample of [false, true]) {
    if (remaining() < MIN_REPLY_MS) {
      if (replyText === null) replyFlags = ["reply_no_time"];
      break;
    }
    replyAttempts++;
    let text: string | null = null;
    try {
      const response = await callModel(config, rules.privacy.sanitized, replyContext, fetchImpl, "reply", remaining(), sample);
      latency += response.latency_ms;
      text = response.reply?.trim() || null;
    } catch (error) {
      if (replyText === null) replyFlags = [modelError(error).replace("model_", "reply_")];
      continue;
    }
    if (!text) {
      if (replyText === null) replyFlags = ["reply_not_generated"];
      continue;
    }
    const checked = validateModelReply(text, payload, input.message, derived.sla.estimated_compensation_inr);
    const reasons = checked.ok ? [] : checked.reasons;
    if (replyText === null || reasons.length < replyFlags.length) {
      replyText = text;
      replyFlags = reasons;
    }
    if (!reasons.length) break;
  }

  const reply = replyText
    ? splitReply(replyText)
    : { introduction: "", steps: [], escalation: "", text: "" };
  const policy = policyCheck(reply.text, payload);
  return {
    ...derived,
    reply,
    audit: {
      ...derived.audit,
      ...policy,
      model: {
        status: "used",
        model,
        latency_ms: latency,
        reply: { source: "model" },
        authority: {
          review_required: payloadFlags.length > 0 || replyFlags.length > 0 || !replyText,
          payload_flags: payloadFlags,
          reply_flags: replyText ? replyFlags : replyFlags.length ? replyFlags : ["reply_not_generated"],
          attempts: { payload: payloadAttempts, reply: replyAttempts },
        },
      },
    },
  };
}

/** Model first, rules fallback. Rules always run and remain the safety net. */
export async function triageWithModel(
  raw: TriageInput,
  config: ModelConfig | undefined,
  fetchImpl: Fetch = fetch,
): Promise<TriageResult> {
  const input = inputSchema.parse(raw);
  const rules = triage(raw);
  if (!config) return rules;
  if (config.authority === "model") return triageModelAuthority(raw, input, rules, config, fetchImpl);
  // The pilot model was trained on five languages only. For any other
  // language the rules engine answers, and the reason is shown.
  if (!MODEL_LANGUAGES.includes(rules.payload.detected_language))
    return triage(raw, {
      model: {
        status: "fallback",
        reasons: ["language_outside_model_training"],
        model: null,
        latency_ms: null,
      },
    });
  const started = Date.now();
  let reply: z.infer<typeof serverResponse>;
  try {
    reply = await callModel(
      config,
      rules.privacy.sanitized,
      operatorContext(raw),
      fetchImpl,
    );
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? "model_timeout"
        : error instanceof Error &&
            (error.message.startsWith("model_http_") || error.message === "model_busy")
          ? error.message
          : "model_unavailable";
    return triage(raw, {
      model: { status: "fallback", reasons: [reason], model: null, latency_ms: null },
    });
  }
  const model: ModelInfo = reply.model;
  let checked = validateModelPayload(reply.raw, input, rules);
  // The model extracts facts; the liability tier and the mandatory actions
  // are policy decisions. The rules derive both from the model's category and
  // the operator context, and the merged payload must pass every gate. The
  // audit records whatever the rules changed.
  let policyFromRules: PolicyFromRules | undefined;
  const parsed = (() => {
    try {
      return payloadSchema.safeParse(parseStrictJson(reply.raw.trim()));
    } catch {
      return null;
    }
  })();
  if (parsed?.success) {
    const policy = triage(raw, { category: parsed.data.dispute_category }).payload;
    // Urgency may be raised by the model but never lowered below the rules.
    const panic =
      PANIC_RANK[parsed.data.panic_severity] >= PANIC_RANK[policy.panic_severity]
        ? parsed.data.panic_severity
        : policy.panic_severity;
    // In auto mode the language comes from the script and marker rules, which
    // choose the reply template; the model's guess does not.
    const language =
      input.language === "auto" ? policy.detected_language : parsed.data.detected_language;
    const merged = {
      ...parsed.data,
      rbi_liability_tier: policy.rbi_liability_tier,
      mandatory_actions: policy.mandatory_actions,
      panic_severity: panic,
      detected_language: language,
    };
    const retried = validateModelPayload(JSON.stringify(merged), input, rules);
    if (retried.ok) {
      checked = retried;
      const added = policy.mandatory_actions.filter((a) => !parsed.data.mandatory_actions.includes(a));
      const removed = parsed.data.mandatory_actions.filter((a) => !policy.mandatory_actions.includes(a));
      const tierChanged = parsed.data.rbi_liability_tier !== policy.rbi_liability_tier;
      const panicRaised = panic !== parsed.data.panic_severity;
      const languageChanged = language !== parsed.data.detected_language;
      if (tierChanged || added.length || removed.length || panicRaised || languageChanged)
        policyFromRules = {
          ...(tierChanged
            ? { tier: { model: parsed.data.rbi_liability_tier, rules: policy.rbi_liability_tier } }
            : {}),
          ...(added.length || removed.length ? { actions: { added, removed } } : {}),
          ...(panicRaised ? { panic: { model: parsed.data.panic_severity, rules: panic } } : {}),
          ...(languageChanged
            ? { language: { model: parsed.data.detected_language, rules: language } }
            : {}),
        };
    } else checked = retried;
  }
  if (!checked.ok)
    return triage(raw, {
      model: {
        status: "fallback",
        reasons: checked.reasons,
        model,
        latency_ms: reply.latency_ms,
      },
    });
  const result = triage(raw, {
    payload: checked.payload,
    model: {
      status: "used",
      model,
      latency_ms: reply.latency_ms,
      ...(policyFromRules ? { policy_from_rules: policyFromRules } : {}),
    },
  });
  // The model's own reply replaces the template only if it passes every
  // check; otherwise the template is used and the reasons are shown.
  if (!config.replies) return result; // templates write the reply (default)
  // The reply is asked for only now, once the payload is used, so a payload
  // the gates reject never costs the time of writing a reply.
  if (result.audit.model.status !== "used") return result;
  const written = await modelReply(config, rules.privacy.sanitized, raw, fetchImpl, started);
  const replyCheck =
    "text" in written
      ? validateModelReply(written.text, result.payload, input.message, result.sla.estimated_compensation_inr)
      : { ok: false as const, reasons: [written.reason] };
  if (replyCheck.ok) {
    const policy = policyCheck(replyCheck.reply.text, result.payload);
    if (result.audit.model.status === "used") result.audit.model.reply = { source: "model" };
    return {
      ...result,
      reply: replyCheck.reply,
      audit: { ...result.audit, ...policy },
    };
  }
  if (result.audit.model.status === "used")
    result.audit.model.reply = { source: "template", reasons: replyCheck.reasons };
  // The template reply must still pass the same gates.
  if (!result.audit.no_unauthorized_promises || !result.audit.fraud_rails_present)
    return triage(raw, {
      model: {
        status: "fallback",
        reasons: ["reply_policy_gate"],
        model,
        latency_ms: reply.latency_ms,
      },
    });
  return result;
}
