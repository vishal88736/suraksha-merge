import { z } from "zod";
import { payloadSchema } from "./engine.ts";
const span = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  type: z.string(),
  replacement: z.string(),
});
const modelInfo = z.object({
  base_model: z.string(),
  base_revision: z.string(),
  adapter: z.string().nullable(),
  adapter_sha256: z.string().nullable(),
  quantization: z.string(),
  unreviewed_pilot: z.boolean(),
});
/** Validate what the UI consumes rather than casting arbitrary responses to never. */
export const triageResponseSchema = z.object({
  payload: payloadSchema,
  reply: z.object({
    introduction: z.string(),
    steps: z.array(z.string()),
    escalation: z.string(),
    text: z.string(),
  }),
  privacy: z.object({
    sanitized: z.string(),
    redactions: z.array(span),
    anchors: z.array(span),
    backend: z.literal("contextual-regex"),
  }),
  evidence: z.array(
    z.object({
      field: z.string(),
      value: z.union([z.string(), z.number().finite()]),
      source: z.enum(["customer_message", "operator_context"]),
      start: z.number().int().nonnegative().optional(),
      end: z.number().int().nonnegative().optional(),
    }),
  ),
  warnings: z.array(z.string()),
  sla: z.object({
    deadline_days: z.number().int().positive().nullable(),
    deadline_day_basis: z.literal("calendar").nullable(),
    reporting_delay_day_basis: z.literal("working"),
    elapsed_calendar_days: z.number().int().nonnegative().nullable(),
    estimated_compensation_inr: z.number().finite().nonnegative().nullable(),
    liability_cap_inr: z.number().finite().nonnegative().nullable(),
    liability_cap_basis: z.enum(["amount_and_cap", "cap_only"]).nullable(),
    policy_revalidation_required: z.boolean(),
  }),
  audit: z.object({
    policy_version: z.string(),
    mode: z.enum(["deterministic_preview", "model_validated"]),
    model: z.discriminatedUnion("status", [
      z.object({ status: z.literal("not_configured") }),
      z.object({
        status: z.literal("used"),
        model: modelInfo,
        latency_ms: z.number().finite().nonnegative(),
        tier_from_rules: z
          .object({ model_tier: z.string(), rules_tier: z.string() })
          .optional(),
      }),
      z.object({
        status: z.literal("fallback"),
        reasons: z.array(z.string()),
        model: modelInfo.nullable(),
        latency_ms: z.number().finite().nonnegative().nullable(),
      }),
    ]),
    schema_valid: z.literal(true),
    utr_grounded: z.boolean().nullable(),
    no_unauthorized_promises: z.boolean(),
    fraud_rails_present: z.boolean(),
    pii_backend: z.literal("contextual-regex"),
    external_actions_taken: z.literal(false),
    elapsed_ms: z.number().finite().nonnegative(),
    source_ids: z.array(z.string()),
  }),
});
