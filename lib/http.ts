export const MAX_BODY_BYTES = 80_000; // 12k UTF-16 characters, including escaped Indic text.
export const MAX_BODY_CHARS = 80_000;
export const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
export type ApiErrorCode =
  | "unsupported_media_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_input"
  | "request_timeout"
  | "unauthorized"
  | "rate_limited"
  | "method_not_allowed"
  | "internal_error";
export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId = crypto.randomUUID(),
  extra: Record<string, string> = {},
) {
  return Response.json(
    { error: { code, message, request_id: requestId } },
    { status, headers: { ...NO_STORE, "x-request-id": requestId, ...extra } },
  );
}
export class BodyReadError extends Error {
  readonly code: "payload_too_large" | "request_timeout" | "invalid_json";
  constructor(code: "payload_too_large" | "request_timeout" | "invalid_json") {
    super(code);
    this.code = code;
  }
}
/** Enforce a byte budget and a total deadline even without Content-Length. */
export async function readBoundedText(
  request: Request | Response,
  options: { maxBytes?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_BODY_BYTES;
  const timeoutMs = options.timeoutMs ?? 5000;
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes)
    throw new BodyReadError("payload_too_large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const interrupted = new Promise<never>((_, reject) => {
    const fail = () => reject(new BodyReadError("request_timeout"));
    timer = setTimeout(fail, timeoutMs);
    abort = fail;
    if (options.signal?.aborted) fail();
    else options.signal?.addEventListener("abort", fail, { once: true });
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) throw new BodyReadError("payload_too_large");
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new BodyReadError("invalid_json");
    }
  } catch (error) {
    // Cancellation must not itself become an unbounded wait on a broken stream.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    if (abort) options.signal?.removeEventListener("abort", abort);
    try {
      reader.releaseLock();
    } catch {
      /* A cancelled read may still be settling. */
    }
  }
}
