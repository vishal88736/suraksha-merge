"use client";
import { memo } from "react";

/**
 * Render a message with masked spans highlighted. The masked form is what the
 * engine saw; the placeholders make the redactions visible to the operator.
 */
export const MaskedText = memo(function MaskedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[A-Z_]+\]|\b\d{12}\b)/g).map((part, index) => (
        <span
          key={index}
          className={
            /^\[/.test(part) ? "masked" : /^\d{12}$/.test(part) ? "anchor" : ""
          }
        >
          {part}
        </span>
      ))}
    </>
  );
});
