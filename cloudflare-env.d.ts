declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Optional shared secret. When set, /api/triage requires x-api-key. */
    TRIAGE_API_KEY?: string;
    /**
     * Optional Cloudflare Rate Limiting binding for a quota shared by every
     * Worker instance. Without it the per-instance limiter applies.
     */
    TRIAGE_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
    /** Optional loopback URL of scripts/serve_model.py, e.g. http://127.0.0.1:8765 */
    SURAKSHA_MODEL_URL?: string;
    /** Optional bearer token shared with the local model server. */
    SURAKSHA_MODEL_TOKEN?: string;
    /** Optional model request timeout in milliseconds (1000–15000). */
    SURAKSHA_MODEL_TIMEOUT_MS?: string;
    /** "true" to allow an https model endpoint with a bearer token. */
    SURAKSHA_MODEL_ALLOW_REMOTE?: string;
  }
}
