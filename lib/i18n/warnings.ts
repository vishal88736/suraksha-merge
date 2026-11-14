/**
 * The engine reports warnings in English (they are also part of the API and
 * exported traces). The desk shows them in the interface language.
 */
import type { MessageKey, MessageVars } from "./catalog.ts";

const EXACT: Record<string, MessageKey> = {
  "The transaction date is after today; check the date.": "warning.futureDate",
  "Multiple transaction references found; select the disputed transaction before extraction.":
    "warning.multipleUtr",
  "A unique labelled 12-digit UTR/RRN is required for transaction verification.":
    "warning.utrRequired",
  "An amount has an invalid format or precision; confirm it from the transaction receipt.":
    "warning.amountInvalid",
  "Conflicting amounts found; human confirmation is required.": "warning.amountConflict",
  "Reporting-delay evidence conflicts or is out of range; bank verification is required.":
    "warning.delayConflict",
  "Responsibility/authorisation is unverified. Reporting within 3 working days alone does not establish zero liability.":
    "warning.responsibilityUnverified",
  "Transactions from 1 January 2027 require policy revalidation under the upcoming RBI amendment.":
    "warning.policy2027",
};

/** Catalog key and variables for an engine warning, or null to show it as is. */
export function warningMessage(
  warning: string,
): { key: MessageKey; vars?: MessageVars } | null {
  const key = EXACT[warning];
  if (key) return { key };
  const fallback = /^No checked reply templates for (.+) yet; the draft is in English\.$/.exec(warning);
  if (fallback) return { key: "warning.noTemplates", vars: { language: fallback[1]! } };
  return null;
}
