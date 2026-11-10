/**
 * Language signals.
 *
 * Detection runs on the sanitized message only. Word lists live here as data
 * so the detection rules can be reviewed, extended and versioned without
 * touching the engine.
 */
export const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/u;
export const DEVANAGARI_SCRIPT = /[\u0900-\u097F]/u;

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

function containsWord(haystack: string, words: readonly string[]): boolean {
  for (const word of words) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`,
      "iu",
    );
    if (pattern.test(haystack)) return true;
  }
  return false;
}

/**
 * Detect the language of a sanitized message.
 *
 * Script detection comes first because it is the strongest signal; word
 * lists only break ties between languages that share a script.
 */
export function detectLanguage(
  text: string,
): "hinglish" | "tanglish" | "marathi_english" | "hindi_devanagari" | "english" {
  if (DEVANAGARI_SCRIPT.test(text))
    return containsWord(text, MARATHI_DEVANAGARI_WORDS)
      ? "marathi_english"
      : "hindi_devanagari";
  if (TAMIL_SCRIPT.test(text)) return "tanglish";
  if (containsWord(text, TANGLISH_WORDS)) return "tanglish";
  if (containsWord(text, MARATHI_WORDS)) return "marathi_english";
  if (containsWord(text, HINGLISH_WORDS)) return "hinglish";
  return "english";
}
