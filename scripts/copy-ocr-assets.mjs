/**
 * Copy the on-device OCR assets (Tesseract worker, WebAssembly core, English
 * language data) from node_modules into public/ocr, so screenshots are read
 * in the browser from the app's own origin. Run before dev and build.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}public/ocr/`;
const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
];
mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  if (!existsSync(root + from)) {
    console.warn(`[ocr] missing ${from}; screenshot reading is unavailable until npm ci`);
    continue;
  }
  copyFileSync(root + from, out + to);
}
