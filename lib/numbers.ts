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
  for (const match of text.matchAll(
    /(?<![\p{L}\p{N}])(?:₹|rs\.?|inr)\s*([0-9][0-9,.]*)/giu,
  )) {
    const token = match[1]!.replace(/[.,]$/, "");
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
    const start = match.index! + match[0].lastIndexOf(match[1]!);
    hits.push({ value, start, end: start + token.length });
  }
  return { hits, invalid };
}
