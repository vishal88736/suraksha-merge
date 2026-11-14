/** Decimal digit normalization preserves UTF-16 offsets for supported Indic scripts. */
const ZEROS = [
  0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66,
  0x0660, 0x06f0, 0xff10,
];
export function asciiDigits(text: string): string {
  return text.replace(
    /[\u0966-\u096f\u09e6-\u09ef\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0be6-\u0bef\u0c66-\u0c6f\u0ce6-\u0cef\u0d66-\u0d6f\u0660-\u0669\u06f0-\u06f9\uff10-\uff19]/g,
    (char) => {
      const value = char.charCodeAt(0);
      const zero = ZEROS.find((base) => value >= base && value <= base + 9)!;
      return String(value - zero);
    },
  );
}
export function findAmounts(message: string): {
  hits: { value: number; start: number; end: number }[];
  invalid: boolean;
} {
  const text = asciiDigits(message);
  const hits: { value: number; start: number; end: number }[] = [];
  let invalid = false;
  // "₹500", "Rs.500", "INR 500" and, as customers also write, "500 rupaye",
  // "10,000 rupees", "200/-" or a currency word in an Indian script.
  const prefixed = /(?<![\p{L}\p{N}])(?:₹|rs\.?|inr)\s*([0-9][0-9,.]*)/giu;
  const suffixed =
    /(?<![\p{L}\p{N}.,])([0-9][0-9,.]*)\s*(?:rupaye|rupaiye|rupay|rupees?|rupiya|rupiye|rs\.?(?![\p{L}])|\/-|रुपये|रुपए|रुपया|রুপি|টাকা|ரூபாய்|రూపాయ|ರೂಪಾಯಿ|രൂപ|રૂપિયા|ਰੁਪਏ|روپے|روپیہ|ଟଙ୍କା)(?![\p{L}\p{M}])/giu;
  // "Paid 1,850 to ...", "sent 500", "3000 bhej diye": a bare number counts
  // only right after (or, in Hinglish, before) a payment verb, only in a valid
  // amount shape, and never when a unit follows ("sent 2 times", "paid 3 days ago").
  const shape = "(?:[1-9]\\d{0,6}|[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d?(?:,\\d{2})*,\\d{3})(?:\\.\\d{1,2})?";
  const unit =
    "(?!\\s*(?:times?|days?|hours?|hrs?|mins?|minutes?|months?|years?|weeks?|am|pm|baar|din|ghante|mahine|people|log|digits?|lakhs?|lacs?|k\\b|crores?|cr\\b|thousand|hundred|hazaa?r|sau\\b|%|:))";
  const verbed = new RegExp(
    `(?<![\\p{L}])(?:paid|payed|sent|transferred|debited|deducted)\\s+(?:of\\s+|about\\s+|around\\s+)?(${shape})(?![\\p{N}]|[,.]\\p{N})${unit}` +
      `|(?<![\\p{L}\\p{N}.,])(${shape})(?![\\p{N}]|[,.]\\p{N})\\s+(?:bhej|transfer\\s+ki|transfer\\s+kiye|pay\\s+ki|pay\\s+kiye|kat\\s+ga|debit\\s+ho|(?:got|was|were|has\\s+been|have\\s+been|is|been)\\s+(?:debited|deducted|cut|taken))`,
    "giu",
  );
  const seen = new Set<number>();
  for (const pattern of [prefixed, suffixed, verbed])
  for (const match of text.matchAll(pattern)) {
    const raw = (match[1] ?? match[2])!;
    const token = raw.replace(/[.,]$/, "");
    const tokenStart = match.index! + match[0].indexOf(raw);
    if (seen.has(tokenStart)) continue; // "Rs 500 rupees" is one amount
    seen.add(tokenStart);
    const prefix = text.slice(Math.max(0, match.index! - 45), match.index!);
    if (
      /(?:aadha+a?r|uidai|account|phone|mobile)\s*(?:number|no\.?|is)?\s*[:=-]?\s*$/i.test(
        prefix,
      )
    ) {
      invalid = true;
      continue;
    }
    const valid =
      /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d?(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(
        token,
      );
    if (!valid || token.length > 30) {
      invalid = true;
      continue;
    }
    const [whole, fractional = ""] = token.replaceAll(",", "").split(".");
    const paise = BigInt(whole!) * 100n + BigInt(fractional.padEnd(2, "0"));
    if (paise <= 0n || paise > BigInt(Number.MAX_SAFE_INTEGER)) {
      invalid = true;
      continue;
    }
    const value = Number(paise) / 100;
    if (Math.round(value * 100) !== Number(paise)) {
      invalid = true;
      continue;
    }
    hits.push({ value, start: tokenStart, end: tokenStart + token.length });
  }
  return { hits, invalid };
}
