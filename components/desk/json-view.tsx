"use client";
import { memo, useMemo } from "react";

/** A quoted string, a literal or a number: the parts worth colouring. */
const TOKEN_SPLIT =
  /("[^"]*"(?=\s*:)|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b|\b\d+(?:\.\d+)?\b)/g;

/**
 * Classify one token. A key is a quoted token that is immediately followed
 * by a colon; looking at the token's own position avoids mis-reading a value
 * that happens to contain the same text as a key on the same line.
 */
function classifyToken(line: string, part: string, index: number): string {
  if (!/^".*"$/.test(part))
    return /^(null|true|false|\d)/.test(part) ? "json-literal" : "";
  const after = line.slice(index + part.length);
  return /^\s*:/.test(after) ? "json-key" : "json-value";
}

type Row = { number: number; tokens: { text: string; cls: string }[] };

function tokenize(value: unknown): Row[] {
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line, rowIndex) => {
      let cursor = 0;
      const tokens = line.split(TOKEN_SPLIT).map((part) => {
        const index = cursor;
        cursor += part.length;
        return { text: part, cls: classifyToken(line, part, index) };
      });
      return { number: rowIndex + 1, tokens };
    });
}

export const JsonView = memo(function JsonView({ value }: { value: unknown }) {
  const rows = useMemo(() => tokenize(value), [value]);
  return (
    <pre className="json-code" tabIndex={0} aria-label="Structured triage JSON">
      {rows.map((row) => (
        <div key={row.number}>
          <span className="line-no" aria-hidden="true">
            {row.number}
          </span>
          <code>
            {row.tokens.map((token, index) => (
              <span key={index} className={token.cls}>
                {token.text}
              </span>
            ))}
          </code>
        </div>
      ))}
    </pre>
  );
});
