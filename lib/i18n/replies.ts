/**
 * Customer reply templates, one bundle per supported reply language.
 *
 * The engine never assembles a sentence itself: it selects a bundle and
 * fills placeholders. That keeps the wording reviewable, translatable and
 * identical between the runtime and the research pipeline.
 *
 * Placeholders: {utr}, {deadline}, {dayUnit}, {category}, {compensation}.
 */
import type { ReplyLanguage } from "./locales.ts";
import { GENERATED_REPLIES } from "./generated/replies.ts";
import {
  AUTHORED_TEMPLATES,
  type ReplyTemplates,
} from "./replies-authored.ts";

export type { AuthoredReplyLanguage, ReplyTemplates } from "./replies-authored.ts";

export const REPLY_TEMPLATES: Record<ReplyLanguage, ReplyTemplates> = {
  ...AUTHORED_TEMPLATES,
  ...GENERATED_REPLIES,
};

/** Bundles that are machine translations awaiting native-speaker review. */
export const MACHINE_TRANSLATED_REPLIES = new Set<ReplyLanguage>(
  Object.keys(GENERATED_REPLIES) as ReplyLanguage[],
);

/** Fill {token} placeholders in a template. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
