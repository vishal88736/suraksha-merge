import { inputSchema, triage } from "../../../lib/engine.ts";

/** Hard ceiling on the request body, in bytes. */
const MAX_BODY_BYTES = 32_000;
/** Ceiling on the character count of the body, which may be multi-byte text. */
const MAX_BODY_CHARS = 16_000;

type ErrorCode =
  | "unsupported_media_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_input"
  | "internal_error";

const NO_STORE = { "Cache-Control": "no-store" };

function failure(
  code: ErrorCode,
  message: string,
  status: number,
  requestId: string,
  headers: Record<string, string> = {},
) {
  return Response.json(
    { error: { code, message, request_id: requestId } },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

/**
 * Read the body with a byte ceiling instead of buffering it first. A
 * client-supplied content-length is only an optimisation: it can be absent,
 * stripped by a proxy or spoofed low.
 */
async function readBody(
  request: Request,
): Promise<{ ok: true; text: string } | { ok: false; reason: "too_large" }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
    return { ok: false, reason: "too_large" };
  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: "" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }
  const text = new TextDecoder().decode(concat(chunks, total));
  return { ok: true, text };
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("application/json"))
    return failure(
      "unsupported_media_type",
      "Send the request as application/json.",
      415,
      requestId,
    );

  let raw: string;
  try {
    const body = await readBody(request);
    if (!body.ok)
      return failure(
        "payload_too_large",
        "Message too large.",
        413,
        requestId,
      );
    raw = body.text;
  } catch {
    return failure(
      "invalid_json",
      "Unable to read the request. Check the message and try again.",
      400,
      requestId,
    );
  }

  if (raw.length > MAX_BODY_CHARS)
    return failure("payload_too_large", "Message too large.", 413, requestId);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return failure(
      "invalid_json",
      "The request body was not valid JSON.",
      400,
      requestId,
    );
  }

  const parsed = inputSchema.safeParse(parsedJson);
  if (!parsed.success)
    return failure(
      "invalid_input",
      parsed.error.issues.map((i) => i.message).join(" "),
      400,
      requestId,
    );

  try {
    return Response.json(triage(parsed.data), {
      headers: { ...NO_STORE, "x-request-id": requestId },
    });
  } catch (error) {
    // Never echo customer text into a log line or a response body.
    console.error(
      JSON.stringify({
        level: "error",
        request_id: requestId,
        code: "internal_error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return failure(
      "internal_error",
      "Triage could not be completed. Please try again.",
      500,
      requestId,
    );
  }
}
