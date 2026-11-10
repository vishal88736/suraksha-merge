/** Reject ambiguous JSON before it crosses the API boundary. */
export function parseStrictJson(text: string, maxDepth = 48): unknown {
  // The native parser validates grammar and escapes; the scan below checks
  // duplicate decoded keys and nesting, which JSON.parse silently tolerates.
  const parsed: unknown = JSON.parse(text);
  let index = 0;
  const space = () => { while (/\s/.test(text[index] ?? "") && index < text.length) index++; };
  const string = (): string => {
    const start = index++;
    while (index < text.length) {
      const char = text[index++];
      if (char === "\\") index++;
      else if (char === '"') return JSON.parse(text.slice(start, index)) as string;
    }
    throw new SyntaxError("Invalid JSON string");
  };
  const value = (depth: number): void => {
    if (depth > maxDepth) throw new SyntaxError("JSON nesting limit exceeded");
    space();
    const char = text[index];
    if (char === '"') { string(); return; }
    if (char === "{") {
      index++; space();
      const keys = new Set<string>();
      if (text[index] === "}") { index++; return; }
      while (index < text.length) {
        space(); const key = string();
        if (keys.has(key)) throw new SyntaxError("Duplicate JSON key");
        keys.add(key); space(); index++; value(depth + 1); space();
        if (text[index++] === "}") return;
      }
    } else if (char === "[") {
      index++; space();
      if (text[index] === "]") { index++; return; }
      while (index < text.length) {
        value(depth + 1); space();
        if (text[index++] === "]") return;
      }
    } else {
      const start = index;
      while (index < text.length && !/[\s,\]}]/.test(text[index]!)) index++;
      const literal = text.slice(start, index);
      if (literal !== "null" && literal !== "true" && literal !== "false" && !Number.isFinite(Number(literal)))
        throw new SyntaxError("Non-finite JSON number");
    }
  };
  value(0);
  return parsed;
}
