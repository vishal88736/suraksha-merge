import { z } from "zod";
import {
  inputSchema,
  isFraud,
  payloadSchema,
  triage,
  type ModelAudit,
  type ModelInfo,
  type Payload,
  type TriageInput,
  type TriageResult,
} from "./engine.ts";
import { findAmounts } from "./numbers.ts";
import { MODEL_LANGUAGES } from "./i18n/locales.ts";
import { parseStrictJson } from "./strict-json.ts";
import type { ModelConfig } from "./model-config.ts";

const MAX_RAW_CHARS = 8_000;

const serverResponse = z.object({
  raw: z.string().max(MAX_RAW_CHARS),
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
) {
  const response = await fetchImpl(`${config.url}/v1/triage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      // The server drops queued work it could not start before this budget.
      "x-suraksha-deadline-ms": String(config.timeoutMs),
    },
    body: JSON.stringify({ message: sanitized, context }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (response.status === 503) throw new Error("model_busy");
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  const text = await response.text();
  if (text.length > MAX_RAW_CHARS * 2) throw new Error("model_response_too_large");
  return serverResponse.parse(JSON.parse(text));
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
  // The customer reply is template-built; it must still pass the same gates.
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
