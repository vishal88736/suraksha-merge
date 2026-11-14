import { AsyncLocalStorage } from "node:async_hooks";

/** Local inference server settings, taken from Worker env per request. */
export type ModelConfig = {
  url: string;
  token?: string;
  timeoutMs: number;
  /** The model also writes the customer reply (SURAKSHA_MODEL_REPLIES=true). */
  replies?: boolean;
};

const configs = new AsyncLocalStorage<ModelConfig | undefined>();

const DEFAULT_TIMEOUT_MS = 35_000;
// Below the browser's 45 s request timeout (lib/triage-client.ts), so the rules
// fallback always has time to answer. Includes writing the customer reply.
export const MAX_TIMEOUT_MS = 35_000;

/**
 * Loopback http endpoints are accepted for the local preview. A remote
 * endpoint additionally needs SURAKSHA_MODEL_ALLOW_REMOTE=true, https and a
 * bearer token (SURAKSHA_MODEL_TOKEN); anything else stays rules-only.
 */
export function modelConfigFromEnv(env: {
  SURAKSHA_MODEL_URL?: string;
  SURAKSHA_MODEL_TOKEN?: string;
  SURAKSHA_MODEL_TIMEOUT_MS?: string;
  SURAKSHA_MODEL_ALLOW_REMOTE?: string;
  SURAKSHA_MODEL_REPLIES?: string;
}): ModelConfig | undefined {
  const raw = env.SURAKSHA_MODEL_URL?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const loopback =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  // A hosted inference endpoint (so a deployed Worker can use the model) is
  // an explicit opt-in, and only over HTTPS with a bearer token: customer
  // messages, already redacted, then leave this Worker.
  const remote =
    env.SURAKSHA_MODEL_ALLOW_REMOTE === "true" &&
    url.protocol === "https:" &&
    Boolean(env.SURAKSHA_MODEL_TOKEN);
  if (!loopback && !remote) return undefined;
  const timeout = Number(env.SURAKSHA_MODEL_TIMEOUT_MS);
  return {
    url: url.origin,
    token: env.SURAKSHA_MODEL_TOKEN || undefined,
    // Opt-in: the model also writes the customer reply (checked before use).
    // Off by default; the reviewed templates write it otherwise.
    ...(env.SURAKSHA_MODEL_REPLIES === "true" ? { replies: true } : {}),
    timeoutMs:
      // Capped below the browser's 45 s client timeout, leaving time for the
      // rules fallback to answer when the model is slow or busy.
      Number.isInteger(timeout) && timeout >= 1000 && timeout <= MAX_TIMEOUT_MS
        ? timeout
        : DEFAULT_TIMEOUT_MS,
  };
}

export function runWithModelConfig<T>(
  config: ModelConfig | undefined,
  run: () => T,
): T {
  return configs.run(config, run);
}

export function getModelConfig(): ModelConfig | undefined {
  return configs.getStore();
}
