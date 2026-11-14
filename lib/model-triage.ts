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

  const amounts = findAmounts(input.message);
  const values = new Set(amounts.hits.map((h) => h.value));
  if (
    p.amount_inr !== null &&
    (amounts.invalid || !values.has(p.amount_inr))
  )
    reasons.push("amount_not_grounded");

  if (
    p.reporting_delay_working_days !== null &&
    p.reporting_delay_working_days !==
      rules.payload.reporting_delay_working_days
  )
    reasons.push("reporting_delay_not_grounded");

  if (input.language !== "auto" && p.detected_language !== input.language)
    reasons.push("language_conflicts_with_operator");

  // The rules' keyword evidence is precise: the model may refine it but not
  // discard it. A vaguer answer, or a missed fraud signal, is not accepted.
  const rulesCategory = rules.payload.dispute_category;
  if (
    p.dispute_category === "NEEDS_INFORMATION" &&
    rulesCategory !== "NEEDS_INFORMATION"
  )
    reasons.push("model_less_specific_than_rules");
  if (isFraud(rulesCategory) && !isFraud(p.dispute_category))
    reasons.push("model_misses_fraud_signal");

  const tier = p.rbi_liability_tier;
  const technical = TECHNICAL_TIER[p.dispute_category];
  if (rules.sla.policy_revalidation_required && tier !== "PENDING_VERIFICATION")
    reasons.push("tier_requires_policy_revalidation");
  else if (tier.startsWith("TECHNICAL_") && tier !== technical)
    reasons.push("tier_inconsistent_with_category");
  else if (EVIDENCE_TIERS.has(tier) && tier !== rules.payload.rbi_liability_tier)
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
    },
    body: JSON.stringify({ message: sanitized, context }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
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
        : error instanceof Error && error.message.startsWith("model_http_")
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
    const merged = {
      ...parsed.data,
      rbi_liability_tier: policy.rbi_liability_tier,
      mandatory_actions: policy.mandatory_actions,
    };
    const retried = validateModelPayload(JSON.stringify(merged), input, rules);
    if (retried.ok) {
      checked = retried;
      const added = policy.mandatory_actions.filter((a) => !parsed.data.mandatory_actions.includes(a));
      const removed = parsed.data.mandatory_actions.filter((a) => !policy.mandatory_actions.includes(a));
      const tierChanged = parsed.data.rbi_liability_tier !== policy.rbi_liability_tier;
      if (tierChanged || added.length || removed.length)
        policyFromRules = {
          ...(tierChanged
            ? { tier: { model: parsed.data.rbi_liability_tier, rules: policy.rbi_liability_tier } }
            : {}),
          ...(added.length || removed.length ? { actions: { added, removed } } : {}),
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
