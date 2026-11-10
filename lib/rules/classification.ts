/**
 * Dispute classification rules.
 *
 * The rules are ordered: the first rule whose signals are present wins, and
 * the order encodes the precedence an operator would use. A QR code is a
 * payment method, never a fraud signal on its own.
 */
export type Category =
  | "P2M_CONFIRMATION_FAILURE"
  | "P2P_BENEFICIARY_NOT_CREDITED"
  | "COLLECT_REQUEST_SCAM"
  | "REMOTE_ACCESS_SCAM"
  | "VOLUNTARY_WRONG_VPA_TRANSFER"
  | "UNAUTHORIZED_ACCOUNT_TAKEOVER"
  | "NEEDS_INFORMATION";

/** Remote-access tooling: the customer installed something on their device. */
export const REMOTE_ACCESS_SIGNALS =
  /anydesk|\.apk\b|remote\s*access|screen[ -]?shar|teamviewer|quick\s*support/i;

/**
 * A collect request needs a market signal: a platform, a buyer or a seller
 * asking for money by QR. "Scanned the shop QR" is a merchant payment.
 */
export const COLLECT_REQUEST_SIGNALS =
  /collect\s*request|advance\s*(?:payment|amount)|(?:olx|facebook|instagram|amazon|buyer|seller|receive\s*money|request\s*money)[\s\S]{0,180}\bqr\b|\bqr\b[\s\S]{0,120}\b(?:scam|fraud|fraudster|cheat|phish|advance\s*payment)\b/i;

/** Money left without the customer's consent. */
export const FRAUD_SIGNALS =
  /\b(?:fraud|fraudster|scam(?:mer|mers|med|ming)?|cheat(?:ed|ing)?|phish(?:ing)?|hacked|compromised|unauthori[sz]ed|stolen|framed|impersonat\w*)\b|not\s*me\b|did\s*not\s*(?:make|authori[sz]e)|bina\s*permission|अनधिकृत/i;

/** The customer states that they sent the money themselves, by mistake. */
export const WRONG_TRANSFER_SIGNALS =
  /wrong\s*(?:vpa|upi|person|account)|galat\s*(?:vpa|upi|account)|chukichya/i;

/** First-person intent that the transfer was voluntary. */
export const VOLUNTARY_INTENT_SIGNALS =
  /\b(?:voluntarily|by\s*(?:mistake|accident)|my\s*mistake|galti\s*se|wrong\s*(?:vpa|upi|account))\b/i;

/** The transaction did not complete as expected. */
export const TECHNICAL_FAILURE_SIGNALS =
  /not\s*(?:credited|received)|stuck|pending|failed|nahi\s*(?:mila|pahuncha)|illa|debitaachu|confirmation|unconfirmed/i;

/** Merchant or acquiring context. */
export const MERCHANT_SIGNALS = /merchant|swiggy|zomato|shop|store|p2m|bigbasket/i;

/** Peer-to-peer transfer context. */
export const P2P_SIGNALS = /transfer|friend|p2p|beneficiary/i;

export const FRAUD_CATEGORIES: readonly Category[] = [
  "COLLECT_REQUEST_SCAM",
  "REMOTE_ACCESS_SCAM",
  "UNAUTHORIZED_ACCOUNT_TAKEOVER",
];

export function isFraudCategory(category: string): boolean {
  return FRAUD_CATEGORIES.includes(category as Category);
}

function positive(text: string, signal: RegExp): boolean {
  for (const match of text.matchAll(new RegExp(signal.source, signal.flags.replace("g", "") + "g"))) {
    const prefix = text.slice(Math.max(0, match.index! - 35), match.index!);
    if (!/\b(?:no|not|never|isn[’']?t|wasn[’']?t)\s+(?:(?:a|an|any)\s+)?$/i.test(prefix)) return true;
  }
  return false;
}

export function classify(text: string): Category {
  if (positive(text, REMOTE_ACCESS_SIGNALS)) return "REMOTE_ACCESS_SCAM";
  if (positive(text, COLLECT_REQUEST_SIGNALS)) return "COLLECT_REQUEST_SCAM";
  // Fraud evidence outranks any benign reading of the same sentence.
  if (positive(text, FRAUD_SIGNALS)) return "UNAUTHORIZED_ACCOUNT_TAKEOVER";
  // A voluntary transfer needs the customer's own statement of intent.
  if (
    WRONG_TRANSFER_SIGNALS.test(text) &&
    VOLUNTARY_INTENT_SIGNALS.test(text)
  )
    return "VOLUNTARY_WRONG_VPA_TRANSFER";
  if (
    TECHNICAL_FAILURE_SIGNALS.test(text) &&
    MERCHANT_SIGNALS.test(text)
  )
    return "P2M_CONFIRMATION_FAILURE";
  if (TECHNICAL_FAILURE_SIGNALS.test(text) && P2P_SIGNALS.test(text))
    return "P2P_BENEFICIARY_NOT_CREDITED";
  return "NEEDS_INFORMATION";
}
