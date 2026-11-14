/**
 * Locale registry.
 *
 * Nothing in this app hardcodes a language: the interface locales and the
 * reply languages are both declared here, together with the BCP-47 tag that
 * the browser speech recogniser and the document element use.
 *
 * The 22 languages of the Eighth Schedule of the Constitution are all
 * supported, each in its primary script. Hinglish, Tanglish and
 * Marathi–English are the romanized registers customers commonly type in;
 * they keep their own Latin-script reply templates. `flores` is the FLORES-200
 * code used by the translation pipeline (scripts/translate_i18n.py).
 */
import { GENERATED_LOCALE_LOADERS } from "./generated/index.ts";

export type Script =
  | "latin"
  | "devanagari"
  | "bengali"
  | "gujarati"
  | "gurmukhi"
  | "kannada"
  | "malayalam"
  | "odia"
  | "tamil"
  | "telugu"
  | "arabic"
  | "ol_chiki"
  | "meetei_mayek";

type IndicLanguage = {
  /** Interface locale code (BCP-47). */
  ui: string;
  /** Reply-language code used in the triage payload. */
  reply: string;
  flores: string;
  label: string;
  nativeLabel: string;
  speech: string;
  script: Script;
  dir: "ltr" | "rtl";
};

/** The 22 scheduled languages, in English alphabetical order. */
export const SCHEDULED_LANGUAGES = [
  { ui: "as", reply: "assamese", flores: "asm_Beng", label: "Assamese", nativeLabel: "অসমীয়া", speech: "as-IN", script: "bengali", dir: "ltr" },
  { ui: "bn", reply: "bengali", flores: "ben_Beng", label: "Bengali", nativeLabel: "বাংলা", speech: "bn-IN", script: "bengali", dir: "ltr" },
  { ui: "brx", reply: "bodo", flores: "brx_Deva", label: "Bodo", nativeLabel: "बड़ो", speech: "brx-IN", script: "devanagari", dir: "ltr" },
  { ui: "doi", reply: "dogri", flores: "doi_Deva", label: "Dogri", nativeLabel: "डोगरी", speech: "doi-IN", script: "devanagari", dir: "ltr" },
  { ui: "gu", reply: "gujarati", flores: "guj_Gujr", label: "Gujarati", nativeLabel: "ગુજરાતી", speech: "gu-IN", script: "gujarati", dir: "ltr" },
  { ui: "hi", reply: "hindi_devanagari", flores: "hin_Deva", label: "Hindi", nativeLabel: "हिन्दी", speech: "hi-IN", script: "devanagari", dir: "ltr" },
  { ui: "kn", reply: "kannada", flores: "kan_Knda", label: "Kannada", nativeLabel: "ಕನ್ನಡ", speech: "kn-IN", script: "kannada", dir: "ltr" },
  { ui: "ks", reply: "kashmiri", flores: "kas_Arab", label: "Kashmiri", nativeLabel: "کٲشُر", speech: "ks-IN", script: "arabic", dir: "rtl" },
  { ui: "kok", reply: "konkani", flores: "gom_Deva", label: "Konkani", nativeLabel: "कोंकणी", speech: "kok-IN", script: "devanagari", dir: "ltr" },
  { ui: "mai", reply: "maithili", flores: "mai_Deva", label: "Maithili", nativeLabel: "मैथिली", speech: "mai-IN", script: "devanagari", dir: "ltr" },
  { ui: "ml", reply: "malayalam", flores: "mal_Mlym", label: "Malayalam", nativeLabel: "മലയാളം", speech: "ml-IN", script: "malayalam", dir: "ltr" },
  { ui: "mni", reply: "manipuri", flores: "mni_Mtei", label: "Manipuri", nativeLabel: "ꯃꯤꯇꯩꯂꯣꯟ", speech: "mni-IN", script: "meetei_mayek", dir: "ltr" },
  { ui: "mr", reply: "marathi", flores: "mar_Deva", label: "Marathi", nativeLabel: "मराठी", speech: "mr-IN", script: "devanagari", dir: "ltr" },
  { ui: "ne", reply: "nepali", flores: "npi_Deva", label: "Nepali", nativeLabel: "नेपाली", speech: "ne-NP", script: "devanagari", dir: "ltr" },
  { ui: "or", reply: "odia", flores: "ory_Orya", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", speech: "or-IN", script: "odia", dir: "ltr" },
  { ui: "pa", reply: "punjabi", flores: "pan_Guru", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", speech: "pa-IN", script: "gurmukhi", dir: "ltr" },
  { ui: "sa", reply: "sanskrit", flores: "san_Deva", label: "Sanskrit", nativeLabel: "संस्कृतम्", speech: "sa-IN", script: "devanagari", dir: "ltr" },
  { ui: "sat", reply: "santali", flores: "sat_Olck", label: "Santali", nativeLabel: "ᱥᱟᱱᱛᱟᱲᱤ", speech: "sat-IN", script: "ol_chiki", dir: "ltr" },
  { ui: "sd", reply: "sindhi", flores: "snd_Arab", label: "Sindhi", nativeLabel: "سنڌي", speech: "sd-IN", script: "arabic", dir: "rtl" },
  { ui: "ta", reply: "tamil", flores: "tam_Taml", label: "Tamil", nativeLabel: "தமிழ்", speech: "ta-IN", script: "tamil", dir: "ltr" },
  { ui: "te", reply: "telugu", flores: "tel_Telu", label: "Telugu", nativeLabel: "తెలుగు", speech: "te-IN", script: "telugu", dir: "ltr" },
  { ui: "ur", reply: "urdu", flores: "urd_Arab", label: "Urdu", nativeLabel: "اردو", speech: "ur-IN", script: "arabic", dir: "rtl" },
] as const satisfies readonly IndicLanguage[];

type Scheduled = (typeof SCHEDULED_LANGUAGES)[number];

/**
 * Languages the interface chrome can be rendered in: English, Hindi
 * (hand-written) and every scheduled language whose machine-translated
 * catalog has been generated and checked.
 */
export const UI_LOCALES = [
  {
    code: "en",
    htmlLang: "en",
    dir: "ltr",
    label: "English",
    nativeLabel: "English",
    speech: "en-IN",
  },
  ...SCHEDULED_LANGUAGES.filter(
    (language) => language.ui === "hi" || language.ui in GENERATED_LOCALE_LOADERS,
  ).map((language) => ({
    code: language.ui,
    htmlLang: language.ui,
    dir: language.dir,
    label: language.label,
    nativeLabel: language.nativeLabel,
    speech: language.speech,
  })),
] as readonly {
  code: "en" | Scheduled["ui"];
  htmlLang: string;
  dir: "ltr" | "rtl";
  label: string;
  nativeLabel: string;
  speech: string;
}[];

export type UiLocale = "en" | Scheduled["ui"];
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

/** Romanized registers with their own Latin-script reply templates. */
const ROMANIZED_LANGUAGES = [
  { code: "hinglish", label: "Hinglish", nativeLabel: "Hinglish", speech: "hi-IN" },
  { code: "tanglish", label: "Tanglish", nativeLabel: "Tanglish", speech: "ta-IN" },
  { code: "marathi_english", label: "Marathi–English", nativeLabel: "Marathi–English", speech: "mr-IN" },
] as const;

export type ReplyLanguage =
  | "english"
  | (typeof ROMANIZED_LANGUAGES)[number]["code"]
  | Scheduled["reply"];

export type ReplyLanguageInfo = {
  code: ReplyLanguage;
  label: string;
  nativeLabel: string;
  speech: string;
  script: Script;
  dir: "ltr" | "rtl";
};

/**
 * Languages a customer draft can be written in. `speech` is the BCP-47 tag
 * handed to the browser recogniser when the operator dictates a message.
 */
export const REPLY_LANGUAGES: readonly ReplyLanguageInfo[] = [
  { code: "english", label: "English", nativeLabel: "English", speech: "en-IN", script: "latin", dir: "ltr" },
  ...ROMANIZED_LANGUAGES.map((language) => ({ ...language, script: "latin" as const, dir: "ltr" as const })),
  ...SCHEDULED_LANGUAGES.map((language) => ({
    code: language.reply,
    label: language.reply === "hindi_devanagari" ? "Hindi (Devanagari)" : language.label,
    nativeLabel: language.nativeLabel,
    speech: language.speech,
    script: language.script,
    dir: language.dir,
  })),
];

/** Every reply-language code, for schema enums. */
export const REPLY_LANGUAGE_CODES = REPLY_LANGUAGES.map(
  (language) => language.code,
) as [ReplyLanguage, ...ReplyLanguage[]];

/**
 * The languages the fine-tuned pilot model was trained on. Any other language
 * is answered by the rules engine (see lib/model-triage.ts); keep this in step
 * with research/common.py:LANGUAGES.
 */
export const MODEL_LANGUAGES: readonly ReplyLanguage[] = [
  "english",
  "hinglish",
  "tanglish",
  "marathi_english",
  "hindi_devanagari",
];

export function replyLanguage(code: ReplyLanguage): ReplyLanguageInfo {
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
 * A block of prose for the interface. English and Hindi are written inline in
 * the content modules; the other locales come from the generated translation
 * tables (lib/i18n/generated/), keyed by the English text.
 */
export type LocalizedText = { en: string; hi: string };

const contentTables: Partial<Record<UiLocale, Record<string, string>>> = {};

/** Register a locale's content table once it is loaded. */
export function registerContent(
  locale: UiLocale,
  table: Record<string, string>,
) {
  contentTables[locale] = table;
}

export function pick(text: LocalizedText, locale: UiLocale): string {
  if (locale === "en" || locale === "hi") return text[locale];
  return contentTables[locale]?.[text.en] ?? text.en;
}
