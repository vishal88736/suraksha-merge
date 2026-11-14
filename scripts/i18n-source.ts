/**
 * Print the English sources the translation pipeline translates
 * (scripts/translate_i18n.py): the interface catalog, every English
 * LocalizedText in the content modules, and the English reply bundle.
 *
 *   node scripts/i18n-source.ts > artifacts/i18n/source.json
 */
import { SOURCE_CATALOG } from "../lib/i18n/catalog.ts";
import { AUTHORED_TEMPLATES } from "../lib/i18n/replies-authored.ts";
import * as scenarios from "../lib/content/scenarios.ts";
import * as mascot from "../lib/content/mascot.ts";
import * as pipeline from "../lib/content/pipeline.ts";
import * as policy from "../lib/policy.ts";

/** Collect the `en` side of every { en, hi } object, recursively. */
function collect(value: unknown, out: Set<string>, seen = new Set<unknown>()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length === 2 &&
    typeof record.en === "string" &&
    typeof record.hi === "string"
  ) {
    out.add(record.en);
    return;
  }
  for (const child of Object.values(record)) collect(child, out, seen);
}

const content = new Set<string>();
for (const source of [scenarios, mascot, pipeline, policy]) collect(source, content);

process.stdout.write(
  JSON.stringify(
    {
      messages: SOURCE_CATALOG,
      content: [...content].sort(),
      replies: AUTHORED_TEMPLATES.english,
    },
    null,
    2,
  ) + "\n",
);
