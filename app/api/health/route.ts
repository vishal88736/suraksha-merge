import { POLICY_VERSION } from "../../../lib/policy";
import { getModelConfig } from "../../../lib/model-config";
import { modelHealth } from "../../../lib/model-health";
export async function GET() {
  const model = await modelHealth(getModelConfig());
  return Response.json(
    {
      status: "ok",
      engine: model.model_reachable
        ? "model_first_rules_fallback"
        : "deterministic_preview",
      policy_version: POLICY_VERSION,
      ...model,
      bank_integration_connected: false,
      persists_customer_messages: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
