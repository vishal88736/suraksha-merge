import { POLICY_VERSION } from "../../../lib/policy";
import { getModelConfig } from "../../../lib/model-config";
import { modelHealth } from "../../../lib/model-health";
export async function GET() {
  const config = getModelConfig();
  const model = await modelHealth(config);
  const authority = config?.authority === "model";
  return Response.json(
    {
      status: "ok",
      engine: authority
        ? model.model_reachable
          ? "model_authority"
          : "model_authority_offline"
        : model.model_reachable
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
