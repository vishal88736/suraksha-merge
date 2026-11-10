import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import { checkRateLimit, clientKey, secretsMatch } from "../lib/rate-limit";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const NO_STORE = { "Cache-Control": "no-store" };
const PROTECTED_PATHS = ["/api/triage"];

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const url = new URL(request.url);
    if (PROTECTED_PATHS.some((path) => url.pathname.startsWith(path))) {
      // Optional shared secret. When it is configured, the endpoint is closed
      // to anyone without it; when it is absent the endpoint stays open.
      const apiKey = env.TRIAGE_API_KEY;
      if (apiKey && !secretsMatch(request.headers.get("x-api-key"), apiKey))
        return Response.json(
          {
            error: {
              code: "unauthorized",
              message: "This endpoint requires a valid API key.",
            },
          },
          { status: 401, headers: NO_STORE },
        );
      const limit = checkRateLimit(clientKey(request));
      if (!limit.ok)
        return Response.json(
          {
            error: {
              code: "rate_limited",
              message: "Too many requests. Please wait a moment and try again.",
            },
          },
          {
            status: 429,
            headers: {
              ...NO_STORE,
              "Retry-After": String(limit.retryAfterSeconds),
            },
          },
        );
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
