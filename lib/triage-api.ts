import {
  inputSchema,
  triage,
  type TriageInput,
  type TriageResult,
} from "./engine.ts";
import { parseStrictJson } from "./strict-json.ts";
import {
  apiError,
  BodyReadError,
  MAX_BODY_CHARS,
  NO_STORE,
  readBoundedText,
} from "./http.ts";

/** The injectable engine permits genuine failure-path checks without altering production globals. */
export function createTriageHandler(
  options: {
    engine?: (input: TriageInput) => TriageResult;
    timeoutMs?: number;
    log?: (event: Record<string, string>) => void;
  } = {},
) {
  return async function handle(request: Request): Promise<Response> {
    const id = crypto.randomUUID();
    if (request.method !== "POST")
      return apiError("method_not_allowed", "Use POST for triage.", 405, id, {
        Allow: "POST",
      });
    const media = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    if (media !== "application/json")
      return apiError(
        "unsupported_media_type",
        "Send the request as application/json.",
        415,
        id,
      );
    let json: unknown;
    try {
      const raw = await readBoundedText(request, {
        timeoutMs: options.timeoutMs,
        signal: request.signal,
      });
      if (raw.length > MAX_BODY_CHARS)
        return apiError("payload_too_large", "Message too large.", 413, id);
      json = parseStrictJson(raw);
    } catch (error) {
      if (error instanceof BodyReadError && error.code === "request_timeout")
        return apiError(
          "request_timeout",
          "The request took too long. Please retry.",
          408,
          id,
        );
      if (error instanceof BodyReadError && error.code === "payload_too_large")
        return apiError("payload_too_large", "Message too large.", 413, id);
      return apiError(
        "invalid_json",
        "Send one valid JSON object with unique keys.",
        400,
        id,
      );
    }
    const parsed = inputSchema.safeParse(json);
    if (!parsed.success) {
      const tooLarge = parsed.error.issues.some(
        (i) => i.code === "too_big" && i.path[0] === "message",
      );
      if (tooLarge)
        return apiError(
          "payload_too_large",
          "Keep the message under 12,000 characters.",
          413,
          id,
        );
      // Do not echo unknown keys, submitted values or arbitrary exception text.
      const known = new Set(Object.keys(inputSchema.shape));
      const fields = [
        ...new Set(
          parsed.error.issues.map((i) =>
            typeof i.path[0] === "string" && known.has(i.path[0])
              ? i.path[0]
              : "input",
          ),
        ),
      ];
      return apiError(
        "invalid_input",
        `Check ${fields.join(", ")}. Provide valid values and a non-empty message.`,
        400,
        id,
      );
    }
    try {
      const result = (options.engine ?? triage)(parsed.data);
      return Response.json(result, {
        headers: { ...NO_STORE, "x-request-id": id },
      });
    } catch {
      (options.log ?? ((event) => console.error(JSON.stringify(event))))({
        level: "error",
        request_id: id,
        code: "internal_error",
      });
      return apiError(
        "internal_error",
        "Triage could not be completed. Please try again.",
        500,
        id,
      );
    }
  };
}
