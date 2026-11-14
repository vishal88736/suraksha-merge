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

/**
 * Every available bundle. Hand-written bundles always exist; machine-translated
 * ones exist only once they have passed the translation checks.
 */
export const REPLY_TEMPLATES: Partial<Record<ReplyLanguage, ReplyTemplates>> = {
  ...GENERATED_REPLIES,
  ...AUTHORED_TEMPLATES,
};

/** Bundles that are machine translations awaiting native-speaker review. */
export const MACHINE_TRANSLATED_REPLIES = new Set<ReplyLanguage>(
  Object.keys(GENERATED_REPLIES) as ReplyLanguage[],
);

export function hasReplyTemplates(language: ReplyLanguage): boolean {
  return language in REPLY_TEMPLATES;
}

/** The bundle for a language, or English when none is available yet. */
export function templatesFor(language: ReplyLanguage): {
  templates: ReplyTemplates;
  fallback: boolean;
} {
  const bundle = REPLY_TEMPLATES[language];
  return bundle
    ? { templates: bundle, fallback: false }
    : { templates: AUTHORED_TEMPLATES.english, fallback: true };
}

/** Fill {token} placeholders in a template. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
