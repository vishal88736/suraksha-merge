/**
 * Locale registry.
 *
 * Nothing in this app hardcodes a language: the interface locales and the
 * reply languages are both declared here, together with the BCP-47 tag that
 * the browser speech recogniser and the document element use.
 */

/** Languages the interface chrome can be rendered in. */
export const UI_LOCALES = [
  {
    code: "en",
    htmlLang: "en",
    dir: "ltr",
    label: "English",
    nativeLabel: "English",
    speech: "en-IN",
  },
  {
    code: "hi",
    htmlLang: "hi",
    dir: "ltr",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    speech: "hi-IN",
  },
] as const;

export type UiLocale = (typeof UI_LOCALES)[number]["code"];
export const DEFAULT_UI_LOCALE: UiLocale = "en";

export function isUiLocale(value: unknown): value is UiLocale {
  return (
    typeof value === "string" &&
    UI_LOCALES.some((locale) => locale.code === value)
  );
}

export function uiLocale(code: UiLocale) {
  return UI_LOCALES.find((locale) => locale.code === code) ?? UI_LOCALES[0];
}

/**
 * Languages a customer draft can be written in. `speech` is the BCP-47 tag
 * handed to the browser recogniser when the operator dictates a message.
 */
export const REPLY_LANGUAGES = [
  {
    code: "english",
    label: "English",
    nativeLabel: "English",
    speech: "en-IN",
    script: "latin",
  },
  {
    code: "hinglish",
    label: "Hinglish",
    nativeLabel: "Hinglish",
    speech: "hi-IN",
    script: "latin",
  },
  {
    code: "hindi_devanagari",
    label: "Hindi (Devanagari)",
    nativeLabel: "हिन्दी (देवनागरी)",
    speech: "hi-IN",
    script: "devanagari",
  },
  {
    code: "tanglish",
    label: "Tanglish",
    nativeLabel: "தமிழ் (தங்கிலீஸ்)",
    speech: "ta-IN",
    script: "latin",
  },
  {
    code: "marathi_english",
    label: "Marathi–English",
    nativeLabel: "मराठी–English",
    speech: "mr-IN",
    script: "latin",
  },
] as const;

export type ReplyLanguage = (typeof REPLY_LANGUAGES)[number]["code"];

export function replyLanguage(code: ReplyLanguage) {
  return (
    REPLY_LANGUAGES.find((language) => language.code === code) ??
    REPLY_LANGUAGES[0]
  );
}

export function isReplyLanguage(value: unknown): value is ReplyLanguage {
  return (
    typeof value === "string" &&
    REPLY_LANGUAGES.some((language) => language.code === value)
  );
}

/**
 * A block of prose that exists in every interface locale. Content modules use
 * this instead of hardcoding a single language.
 */
export type LocalizedText = Record<UiLocale, string>;

export function pick(text: LocalizedText, locale: UiLocale): string {
  return text[locale] ?? text[DEFAULT_UI_LOCALE];
}
