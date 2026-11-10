import type { TriageInput, TriageResult } from "./engine.ts";
import { triageResponseSchema } from "./triage-response.ts";
import { parseStrictJson } from "./strict-json.ts";
import { readBoundedText } from "./http.ts";
export type ClientErrorCode = "unauthorized" | "rate_limited" | "invalid_input" | "payload_too_large" | "timeout" | "network" | "invalid_response" | "unavailable";
export class TriageClientError extends Error {
  readonly code: ClientErrorCode; readonly requestId?: string; readonly retryAfterSeconds?: number;
  constructor(code: ClientErrorCode, requestId?: string, retryAfterSeconds?: number) { super(code); this.code = code; this.requestId = requestId; this.retryAfterSeconds = retryAfterSeconds; }
}
export async function requestTriage(input: TriageInput, options: { signal?: AbortSignal; apiKey?: string; timeoutMs?: number; fetch?: typeof fetch } = {}): Promise<TriageResult> {
  const controller = new AbortController(); let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort(); else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 20_000);
  try {
    const response = await (options.fetch ?? fetch)("/api/triage", { method: "POST", headers: { "Content-Type": "application/json", ...(options.apiKey ? { "x-api-key": options.apiKey } : {}) }, body: JSON.stringify(input), signal: controller.signal, cache: "no-store" });
    const requestId = response.headers.get("x-request-id") ?? undefined;
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new TriageClientError("invalid_response", requestId);
    const raw = await readBoundedText(response, { maxBytes: 160_000, timeoutMs: options.timeoutMs ?? 20_000, signal: controller.signal });
    const body = parseStrictJson(raw);
    if (!response.ok) {
      const codes: Record<number, ClientErrorCode> = { 400: "invalid_input", 401: "unauthorized", 403: "unauthorized", 408: "timeout", 413: "payload_too_large", 429: "rate_limited" };
      const retry = Number(response.headers.get("retry-after"));
      throw new TriageClientError(codes[response.status] ?? "unavailable", requestId, Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : undefined);
    }
    const parsed = triageResponseSchema.safeParse(body);
    if (!parsed.success) throw new TriageClientError("invalid_response", requestId);
    return parsed.data;
  } catch (error) {
    if (timedOut) throw new TriageClientError("timeout");
    if (options.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (error instanceof TriageClientError) throw error;
    if (error instanceof SyntaxError) throw new TriageClientError("invalid_response");
    throw new TriageClientError("network");
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
}
