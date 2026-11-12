import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Feed a real Readable whose chunks deliberately split one Devanagari code
// point. Buffer-to-string concatenation used to replace it with U+FFFD.
test("the Python batch bridge preserves UTF-8 split across input chunks", () => {
  const message = "UPI भुगतान की जानकारी चाहिए।";
  const script = `
    import { Readable } from "node:stream";
    import { setImmediate } from "node:timers/promises";
    const bytes = Buffer.from(JSON.stringify({message: ${JSON.stringify(message)}}) + "\\n");
    const split = bytes.indexOf(Buffer.from("भ")) + 1;
    const stream = Readable.from((async function* () {
      yield bytes.subarray(0, split);
      await setImmediate();
      yield bytes.subarray(split);
    })(), {objectMode: false});
    Object.defineProperty(process, "stdin", {value: stream});
    await import("./scripts/triage.mjs");
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("../", import.meta.url), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const trace = JSON.parse(result.stdout);
  assert.equal(trace.privacy.sanitized, message);
  assert.equal(trace.payload.detected_language, "hindi_devanagari");
  assert.ok(!trace.reply.text.includes("\ufffd"));
});
