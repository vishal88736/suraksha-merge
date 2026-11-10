declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Optional shared secret. When set, /api/triage requires x-api-key. */
    TRIAGE_API_KEY?: string;
  }
}
