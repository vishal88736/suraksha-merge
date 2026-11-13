import { AsyncLocalStorage } from "node:async_hooks";

/** Local inference server settings, taken from Worker env per request. */
export type ModelConfig = {
  url: string;
  token?: string;
  timeoutMs: number;
};

const configs = new AsyncLocalStorage<ModelConfig | undefined>();

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Only loopback http endpoints are accepted: the server runs on the same
 * machine as the local preview and must never receive traffic from elsewhere.
 */
export function modelConfigFromEnv(env: {
  SURAKSHA_MODEL_URL?: string;
  SURAKSHA_MODEL_TOKEN?: string;
  SURAKSHA_MODEL_TIMEOUT_MS?: string;
}): ModelConfig | undefined {
  const raw = env.SURAKSHA_MODEL_URL?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    return undefined;
  const timeout = Number(env.SURAKSHA_MODEL_TIMEOUT_MS);
  return {
    url: url.origin,
    token: env.SURAKSHA_MODEL_TOKEN || undefined,
    timeoutMs:
      Number.isInteger(timeout) && timeout >= 1000 && timeout <= 60_000
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
