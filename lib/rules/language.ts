/**
 * Language signals.
 *
 * Detection runs on the sanitized message only. Word lists live here as data
 * so the detection rules can be reviewed, extended and versioned without
 * touching the engine.
 */
import type { ReplyLanguage } from "../i18n/locales.ts";

export const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/u;
export const DEVANAGARI_SCRIPT = /[\u0900-\u097F]/u;

/**
 * Scripts used by exactly one supported language. Scripts shared by several
 * languages (Devanagari, Bengali–Assamese, Perso-Arabic) are resolved by the
 * word and letter signals below.
 */
const UNIQUE_SCRIPTS: readonly [RegExp, ReplyLanguage][] = [
  [/[\u0B80-\u0BFF]/u, "tamil"],
  [/[\u0C00-\u0C7F]/u, "telugu"],
  [/[\u0C80-\u0CFF]/u, "kannada"],
  [/[\u0D00-\u0D7F]/u, "malayalam"],
  [/[\u0A80-\u0AFF]/u, "gujarati"],
  [/[\u0A00-\u0A7F]/u, "punjabi"],
  [/[\u0B00-\u0B7F]/u, "odia"],
  [/[\u1C50-\u1C7F]/u, "santali"],
  [/[\uABC0-\uABFF\uAAE0-\uAAFF]/u, "manipuri"],
];

export const BENGALI_SCRIPT = /[\u0980-\u09FF]/u;
/** ৰ and ৱ exist only in the Assamese orthography of the Bengali script. */
const ASSAMESE_LETTERS = /[\u09F0\u09F1]/u;
export const ASSAMESE_WORDS = ["মোৰ", "মই", "হৈছে", "নাই", "টকা", "কৰক", "আছে", "কিয়"] as const;

export const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F]/u;
/** Letters used by Sindhi but not Urdu (implosives, aspirates, retroflexes). */
const SINDHI_LETTERS = /[\u0684\u0683\u067B\u0680\u067A\u067D\u067F\u06A6\u06B1\u06B3\u068D\u068C\u068F\u068A\u0699\u06AA]/u;
/** Kashmiri vowel signs and letters absent from Urdu. */
const KASHMIRI_LETTERS = /[\u0672\u0673\u06C4\u06C6\u0655\u065F]/u;

/** Roman-script Tamil (Tanglish) markers. */
export const TANGLISH_WORDS = [
  "enna",
  "panam",
  "anna",
  "aachu",
  "illa",
  "pann",
  "enakku",
  "irukku",
  "kasu",
  "vandhu",
  "poiduchu",
  "debitaachu",
  "sollunga",
  "seivom",
  "thevatha",
  "mattu",
  "naal",
] as const;

/**
 * Roman-script Marathi markers.
 *
 * Only distinctly Marathi forms are listed: "kar" and "ahe" are common in
 * Hinglish, so they must not pull a Hindi message into Marathi.
 */
export const MARATHI_WORDS = [
  "majhe",
  "mala",
  "zale",
  "madat",
  "pahije",
  "gele",
  "gela",
  "kasa",
  "kay",
  "aani",
  "thevu",
  "kele",
] as const;

/** Roman-script Hindi (Hinglish) markers. */
export const HINGLISH_WORDS = [
  "bhai",
  "bhaiya",
  "paise",
  "paisa",
  "gaye",
  "mera",
  "mere",
  "kya",
  "nahi",
  "nahin",
  "jaldi",
  "kat",
  "hua",
  "madad",
  "frod",
  "wapas",
  "hai",
  "kar",
  "dilao",
  "karo",
] as const;

/**
 * Devanagari markers that distinguish Marathi from Hindi. "मदद" and "पैसे"
 * are used in both languages and are deliberately excluded.
 */
export const MARATHI_DEVANAGARI_WORDS = [
  "माझे",
  "मला",
  "झाले",
  "मदत",
  "करा",
  "काय",
  "आहे",
  "गेले",
  "पाठवले",
] as const;

/**
 * Devanagari markers for the other languages written in that script. Hindi
 * is the default; a language wins only with more distinctive markers than
 * Hindi has. Shared words (पैसा, मदद, कृपया) are deliberately excluded.
 */
export const HINDI_DEVANAGARI_WORDS = ["मेरे", "मेरा", "मुझे", "है", "हैं", "गए", "गया", "करें", "नहीं", "में", "का", "की", "हुआ"] as const;
export const DEVANAGARI_LANGUAGE_WORDS: readonly [ReplyLanguage, readonly string[]][] = [
  ["marathi", MARATHI_DEVANAGARI_WORDS],
  ["nepali", ["मेरो", "मलाई", "छ", "छैन", "भयो", "गर्नुहोस्", "पैसा कट्यो", "हुन्छ", "थियो"]],
  ["konkani", ["म्हजे", "म्हाका", "जालें", "पयशे", "आसा", "करात", "कित्याक"]],
  ["maithili", ["हमर", "अछि", "भेल", "छल", "गेल", "कें", "नहि"]],
  ["bodo", ["आंनि", "नङा", "जाबाय", "बिथां", "मोनसे", "नाथाय", "जायो"]],
  ["dogri", ["मिगी", "तुस", "असें", "होई", "कीता", "गेआ", "नेईं"]],
  ["sanskrit", ["अस्ति", "मम", "भवतु", "धनम्", "अभवत्", "कुर्वन्तु", "नास्ति"]],
];

/**
 * Roman-script markers for scheduled languages without a romanized reply
 * bundle: a customer writing romanized Bengali gets a Bengali-script reply.
 * Words shared with Hinglish or Tanglish ("illa", "paisa", "madad") are
 * excluded so they cannot pull those messages away.
 */
export const ROMANIZED_LANGUAGE_WORDS: readonly [ReplyLanguage, readonly string[]][] = [
  ["bengali", ["amar", "taka", "kete", "geche", "hoyni", "korun", "kintu", "ami", "apni", "pelam"]],
  ["telugu", ["naa", "dabbulu", "ayyindi", "raaledu", "cheyandi", "nenu", "meeru", "emi", "povadam"]],
  ["kannada", ["nanna", "hana", "aagide", "maadi", "beku", "naanu", "neevu", "yenu", "hogide", "bandilla"]],
  ["malayalam", ["ente", "kittiyilla", "poyi", "cheyyu", "njan", "ningal", "enthu", "sahayikkoo", "paisa poyi"]],
  ["gujarati", ["maru", "mara", "kapaya", "nathi", "chhe", "tamaru", "maherbani", "gaya che"]],
  ["punjabi", ["tusi", "mainu", "sanu", "kiddan", "hoya", "nahi hoya", "veerji", "paise kat gaye ne"]],
];

function containsWord(haystack: string, words: readonly string[]): boolean {
  return countWords(haystack, words) > 0;
}

/** How many distinct markers from the list occur as whole words. */
function countWords(haystack: string, words: readonly string[]): number {
  let count = 0;
  for (const word of words) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{M}\\p{N}])${word}(?![\\p{L}\\p{M}\\p{N}])`,
      "iu",
    );
    if (pattern.test(haystack)) count += 1;
  }
  return count;
}

function bestOf(
  text: string,
  candidates: readonly [ReplyLanguage, readonly string[]][],
): [ReplyLanguage | null, number] {
  let best: ReplyLanguage | null = null;
  let score = 0;
  for (const [language, words] of candidates) {
    const n = countWords(text, words);
    if (n > score) [best, score] = [language, n];
  }
  return [best, score];
}

/**
 * Detect the language of a sanitized message.
 *
 * Script detection comes first because it is the strongest signal; word
 * lists only break ties between languages that share a script.
 */
export function detectLanguage(text: string): ReplyLanguage {
  for (const [script, language] of UNIQUE_SCRIPTS)
    if (script.test(text)) return language;
  if (BENGALI_SCRIPT.test(text))
    return ASSAMESE_LETTERS.test(text) ||
      countWords(text, ASSAMESE_WORDS) >= 2
      ? "assamese"
      : "bengali";
  if (ARABIC_SCRIPT.test(text)) {
    if (SINDHI_LETTERS.test(text)) return "sindhi";
    if (KASHMIRI_LETTERS.test(text)) return "kashmiri";
    return "urdu";
  }
  if (DEVANAGARI_SCRIPT.test(text)) {
    const hindi = countWords(text, HINDI_DEVANAGARI_WORDS);
    const [other, score] = bestOf(text, DEVANAGARI_LANGUAGE_WORDS);
    return other && score > hindi ? other : "hindi_devanagari";
  }
  // Romanized text. The three registers with their own Latin templates keep
  // their precedence; another language wins only with more markers than all
  // of them.
  const registers = Math.max(
    countWords(text, TANGLISH_WORDS),
    countWords(text, MARATHI_WORDS),
    countWords(text, HINGLISH_WORDS),
  );
  const [romanized, score] = bestOf(text, ROMANIZED_LANGUAGE_WORDS);
  if (romanized && score > registers) return romanized;
  if (containsWord(text, TANGLISH_WORDS)) return "tanglish";
  if (containsWord(text, MARATHI_WORDS)) return "marathi_english";
  if (containsWord(text, HINGLISH_WORDS)) return "hinglish";
  return "english";
}
