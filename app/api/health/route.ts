import { POLICY_VERSION } from "../../../lib/policy";
export function GET() { return Response.json({ status: "ok", engine: "deterministic_preview", policy_version: POLICY_VERSION, trained_model_connected: false, bank_integration_connected: false, persists_customer_messages: false }, { headers: { "Cache-Control": "no-store" } }); }
