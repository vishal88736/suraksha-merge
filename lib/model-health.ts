import { z } from "zod";
import type { ModelConfig } from "./model-config.ts";

const health = z.object({
  status: z.literal("ok"),
  model: z.object({
    base_model: z.string().max(200),
    base_revision: z.string().regex(/^[0-9a-f]{40}$/),
    adapter: z.string().max(500).nullable(),
    adapter_sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    quantization: z.string().max(50),
    fine_tuned: z.boolean(),
    unreviewed_pilot: z.boolean().default(false),
  }),
});

/** Report what is actually reachable. A base model is not a trained model. */
export async function modelHealth(
  config: ModelConfig | undefined,
  fetchImpl: typeof fetch = fetch,
) {
  if (!config)
    return {
      model_endpoint_configured: false,
      model_reachable: false,
      model: null,
      trained_model_connected: false,
    };
  try {
    const response = await fetchImpl(`${config.url}/health`, {
      headers: config.token ? { authorization: `Bearer ${config.token}` } : {},
      signal: AbortSignal.timeout(2_000),
    });
    const body = health.parse(await response.json());
    return {
      model_endpoint_configured: true,
      model_reachable: response.ok,
      model: body.model,
      // An unreviewed pilot adapter is fine-tuned, but not a reviewed trained model.
      trained_model_connected:
        response.ok && body.model.fine_tuned && !body.model.unreviewed_pilot,
    };
  } catch {
    return {
      model_endpoint_configured: true,
      model_reachable: false,
      model: null,
      trained_model_connected: false,
    };
  }
}
