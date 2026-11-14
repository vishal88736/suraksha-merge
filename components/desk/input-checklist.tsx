"use client";
import { useDeferredValue, useMemo } from "react";
import { Check, Circle, CircleDashed } from "lucide-react";
import { triage, isFraud, type TriageInput } from "../../lib/engine.ts";
import { useI18n } from "../../lib/i18n/provider.tsx";
import type { MessageKey } from "../../lib/i18n/catalog.ts";

type Item = {
  key: string;
  label: MessageKey;
  hint: MessageKey;
  done: boolean;
  optional: boolean;
  /** The missing piece is entered under Details rather than in the message. */
  details: boolean;
};

/**
 * Tells the operator, while they type, what the engine has already found in
 * the message and what is still missing. It runs the same rules engine as the
 * assessment, so a ticked item is exactly what the result will contain.
 */
export function InputChecklist({
  input,
  onOpenDetails,
}: {
  input: TriageInput;
  onOpenDetails: () => void;
}) {
  const { t } = useI18n();
  const message = useDeferredValue(input.message);
  const items = useMemo<Item[]>(() => {
    if (!message.trim()) return [];
    let result;
    try {
      result = triage({ ...input, message });
    } catch {
      return [];
    }
    const p = result.payload;
    const fraud = isFraud(p.dispute_category);
    const technical =
      p.dispute_category === "P2P_BENEFICIARY_NOT_CREDITED" ||
      p.dispute_category === "P2M_CONFIRMATION_FAILURE";
    const list: Item[] = [
      {
        key: "what",
        label: "checklist.what",
        hint: "checklist.whatHint",
        done: p.dispute_category !== "NEEDS_INFORMATION",
        optional: false,
        details: false,
      },
      {
        key: "amount",
        label: "checklist.amount",
        hint: "checklist.amountHint",
        done: p.amount_inr !== null,
        optional: false,
        details: false,
      },
      {
        key: "utr",
        label: "checklist.utr",
        hint: "checklist.utrHint",
        done: p.utr_number !== null,
        optional: false,
        details: false,
      },
    ];
    if (technical || p.dispute_category === "NEEDS_INFORMATION")
      list.push({
        key: "when",
        label: "checklist.when",
        hint: "checklist.whenHint",
        done:
          Boolean(input.transaction_date) ||
          (input.elapsed_calendar_days ?? null) !== null,
        optional: true,
        details: true,
      });
    if (fraud)
      list.push({
        key: "fraud",
        label: "checklist.fraud",
        hint: "checklist.fraudHint",
        done:
          (input.reporting_delay_working_days ?? null) !== null &&
          (input.responsibility ?? "unknown") !== "unknown",
        optional: true,
        details: true,
      });
    return list;
  }, [input, message]);

  if (!items.length)
    return (
      <div className="input-checklist empty" aria-live="polite">
        <strong>{t("checklist.title")}</strong>
        <p>{t("checklist.emptyHint")}</p>
      </div>
    );

  const required = items.filter((item) => !item.optional);
  const found = required.filter((item) => item.done).length;
  return (
    <div className="input-checklist" aria-live="polite">
      <div className="checklist-head">
        <strong>{t("checklist.title")}</strong>
        <span>
          {t("checklist.progress", { found, total: required.length })}
        </span>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.key} className={item.done ? "done" : ""}>
            {item.done ? (
              <Check size={14} />
            ) : item.optional ? (
              <CircleDashed size={14} />
            ) : (
              <Circle size={14} />
            )}
            <div>
              <span className="checklist-label">
                {t(item.label)}
                {item.optional && (
                  <em>{t("checklist.optional")}</em>
                )}
              </span>
              {!item.done && (
                <span className="checklist-hint">
                  {t(item.hint)}
                  {item.details && (
                    <button type="button" onClick={onOpenDetails}>
                      {t("checklist.openDetails")}
                    </button>
                  )}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
