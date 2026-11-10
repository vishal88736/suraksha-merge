import { z } from "zod";
import { asciiDigits, findAmounts } from "./numbers.ts";
import { POLICY_VERSION } from "./policy.ts";
import { REPLY_TEMPLATES, fill } from "./i18n/replies.ts";
import { detectLanguage } from "./rules/language.ts";
import { classify, isFraudCategory } from "./rules/classification.ts";

export const CATEGORIES = [
  "P2M_CONFIRMATION_FAILURE",
  "P2P_BENEFICIARY_NOT_CREDITED",
  "COLLECT_REQUEST_SCAM",
  "REMOTE_ACCESS_SCAM",
  "VOLUNTARY_WRONG_VPA_TRANSFER",
  "UNAUTHORIZED_ACCOUNT_TAKEOVER",
  "NEEDS_INFORMATION",
] as const;
export const TIERS = [
  "ZERO_LIABILITY_ELIGIBLE",
  "LIMITED_LIABILITY_ELIGIBLE",
  "BANK_POLICY_REVIEW",
  "CUSTOMER_NEGLIGENCE_REVIEW",
  "TECHNICAL_T_PLUS_1",
  "TECHNICAL_T_PLUS_5",
  "PENDING_VERIFICATION",
] as const;
export const ACTIONS = [
  "CONTACT_BANK_PSP",
  "RAISE_APP_DISPUTE",
  "CALL_1930",
  "REPORT_CYBERCRIME",
  "SECURE_PAYMENT_CHANNEL",
  "REQUEST_UTR",
  "REQUEST_TRANSACTION_DETAILS",
  "TRACK_REVERSAL",
  "REVIEW_COMPENSATION",
  "HUMAN_REVIEW",
] as const;
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

export const inputSchema = z
  .object({
    message: z
      .string()
      .min(1, "Enter a customer message.")
      .max(12000, "Keep the message under 12,000 characters.")
      .refine(value => value.trim().length > 0, "Enter a customer message."),
    reporting_delay_working_days: z
      .number()
      .int()
      .min(0)
      .max(3650)
      .nullable()
      .optional(),
    elapsed_calendar_days: z
      .number()
      .int()
      .min(0)
      .max(3650)
      .nullable()
      .optional(),
    responsibility: z
      .enum(["unknown", "bank", "third_party", "customer"])
      .default("unknown"),
    account_tier: z
      .enum(["unknown", "bsbd", "regular", "other"])
      .default("unknown"),
    language: z
      .enum([
        "auto",
        "hinglish",
        "tanglish",
        "marathi_english",
        "hindi_devanagari",
        "english",
      ])
      .default("auto"),
    transaction_date: z
      .string()
      .refine(isCalendarDate, "Use a valid calendar date (YYYY-MM-DD).")
      .optional(),
  })
  .strict();
export const payloadSchema = z
  .object({
    utr_number: z
      .string()
      .regex(/^\d{12}$/)
      .nullable(),
    dispute_category: z.enum(CATEGORIES),
    amount_inr: z.number().finite().positive().nullable(),
    reporting_delay_working_days: z.number().int().nonnegative().nullable(),
    rbi_liability_tier: z.enum(TIERS),
    mandatory_actions: z.array(z.enum(ACTIONS)).min(1),
    detected_language: z.enum([
      "hinglish",
      "tanglish",
      "marathi_english",
      "hindi_devanagari",
      "english",
    ]),
    panic_severity: z.enum(["LOW", "MEDIUM", "HIGH_CRITICAL"]),
  })
  .strict();
export type TriageInput = z.input<typeof inputSchema>;
export type Payload = z.infer<typeof payloadSchema>;
export type Span = {
  start: number;
  end: number;
  type: string;
  replacement: string;
};
export type Evidence = {
  field: string;
  value: string | number;
  source: "customer_message" | "operator_context";
  start?: number;
  end?: number;
};
// A transaction reference is only trusted when the label in front of it names a
// transaction. Identity keywords that label the number itself disqualify it.
const utrPattern =
  /\b(?:UPI[\s._-]*(?:ref(?:erence)?|transaction[\s._-]*id|txn[\s._-]*id)|(?:txn|transaction)[\s._-]*id|UTR|RRN|ref(?:erence)?(?:\s*(?:no\.?|number|id))?)\s*[:#=-]?\s*(\d{12})\b/gi;
// Checked against the text immediately preceding the label. The keyword must be
// the token that labels the number, not merely a word in the same sentence.
const disqualifyingContext =
  /(?:aadha+a?r|aadhar|adhar|आधार|uidai|a\/c|acct|account|customer|mobile|phone|dob|pan|voter|licen[cs]e|passport|employee)\s*(?:no\.?|number|num|id|detail)?\s*(?:is|of)?\s*[:#=-]?\s*$/i;

export function redactPII(message: string) {
  const scan = asciiDigits(message);
  const money = findAmounts(scan).hits;
  const spans: Span[] = [];
  const anchors: Span[] = [];
  const overlaps = (start: number, end: number) =>
    spans.some((x) => start < x.end && end > x.start) ||
    anchors.some((x) => start < x.end && end > x.start);
  const add = (regex: RegExp, type: string, placeholder: string, group = 0) => {
    for (const match of scan.matchAll(regex)) {
      const value = match[group];
      if (!value) continue;
      const start = match.index! + (group ? match[0].lastIndexOf(value) : 0);
      const end = start + value.length;
      if (overlaps(start, end)) continue;
      if (type === "UNLABELLED_ID" && money.some(a => start >= a.start && end <= a.end)) continue;
      spans.push({ start, end, type, replacement: placeholder });
    }
  };
  // Identity rules claim their spans first: a transaction reference may never
  // cover a value that an identity rule already owns.
  add(
    /\b(?:aadha+a?r|aadhar|adhar|आधार)\s*(?:no\.?|number)?\s*[:#=-]?\s*(\d{4}[ -]?\d{4}[ -]?\d{4})\b/gi,
    "AADHAAR",
    "[AADHAAR_REDACTED]",
    1,
  );
  add(
    /\b(?:a\/c|acct|account)(?:\s*(?:no\.?|number))?\s*[:#=-]?\s*(\d{8,18})\b/gi,
    "ACCOUNT",
    "[ACCOUNT_REDACTED]",
    1,
  );
  add(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "PAN", "[PAN_REDACTED]");
  add(/\b\d{4}[ -]\d{4}[ -]\d{4}\b/g, "SENSITIVE_ID", "[ID_REDACTED]");
  add(/\b(?:otp|pin|cvv|passcode|password)\s*(?:is)?\s*[:#=-]?\s*(\d{3,8})\b/gi, "AUTH_SECRET", "[AUTH_REDACTED]", 1);
  // Scan address tokens once. Numeric local parts must be masked as a whole
  // before generic phone/ID rules can claim part of an email or VPA.
  for (const token of scan.matchAll(/\S+/g)) {
    for (let at = token[0].indexOf("@"); at >= 0; at = token[0].indexOf("@", at+1)) {
      let left=at, right=at+1;
      while(left>0 && /[\p{L}\p{N}_.+%-]/u.test(token[0][left-1]!)) left--;
      while(right<token[0].length && /[\p{L}\p{N}_.-]/u.test(token[0][right]!)) right++;
      while(right>at+1 && /[.,-]/.test(token[0][right-1]!)) right--;
      if(left===at || right===at+1) continue;
      const start=token.index!+left, end=token.index!+right;
      if(!overlaps(start,end)) spans.push({start,end,type:token[0].slice(at+1,right).includes(".")?"EMAIL":"VPA",replacement:token[0].slice(at+1,right).includes(".")?"[EMAIL_REDACTED]":"[VPA_REDACTED]"});
    }
  }
  // Anchors are the only values kept verbatim, and only when a labelled
  // transaction reference survives the identity rules and the context check.
  for (const match of scan.matchAll(utrPattern)) {
    const value = match[1];
    const start = match.index! + match[0].lastIndexOf(value);
    const end = start + value.length;
    if (overlaps(start, end)) continue;
    const prefix = scan.slice(Math.max(0, match.index! - 60), match.index!);
    if (disqualifyingContext.test(prefix)) continue;
    anchors.push({ start, end, type: "UTR", replacement: value });
  }
  add(/(?<!\d)(?:\+91[ -]?)?[6-9]\d{9}(?!\d)/g, "PHONE", "[PHONE_REDACTED]");
  // Any remaining long digit run is an unidentified identifier, not a reference.
  add(/\b\d{8,}\b/g, "UNLABELLED_ID", "[ID_REDACTED]");
  const selected = [...spans].sort((a, b) => a.start - b.start);
  let sanitized = message;
  for (const span of [...selected, ...anchors].sort((a,b) => b.start-a.start))
    sanitized =
      sanitized.slice(0, span.start) +
      span.replacement +
      sanitized.slice(span.end);
  return {
    sanitized,
    redactions: selected,
    anchors,
    backend: "contextual-regex" as const,
  };
}

export function policyCheck(reply: string, payload: Payload) {
  // Keep the window and the language coverage in step with research/common.py
  // so the runtime gate and the training gate never disagree about a reply.
  const guarantees =
    /(?:refund|reversal|chargeback)[\s\S]{0,40}(?:guaranteed|approved|100%)|(?:guarantee|promise)[\s\S]{0,40}(?:refund|reversal|chargeback)|(?:pakka|paka|100%)[\s\S]{0,40}(?:wapas|refund)|(?:ticket|dispute)[\s\S]{0,25}(?:filed|logged|registered)|darj\s*kar\s*(?:diya|liya)|रिफंड[\s\S]{0,20}(?:गारंटी|मंजूर)|பணம்[\s\S]{0,20}உறுதி/i;
  const fraud = isFraud(payload.dispute_category);
  return {
    no_unauthorized_promises: !guarantees.test(reply),
    fraud_rails_present:
      !fraud ||
      (reply.includes("1930") &&
        reply.includes("cybercrime.gov.in") &&
        /bank/i.test(reply)),
  };
}
// Explicit evidence that money left without the customer's consent.
export function isFraud(category: string) {
  return isFraudCategory(category);
}

function draftReply(
  p: Payload,
  sla: {
    deadline_days: number | null;
    estimated_compensation_inr: number | null;
  },
  needsPolicyRevalidation: boolean,
) {
  // The reply is assembled from a template bundle, never from literals in
  // the engine. The bundle is chosen by the detected language, so a customer
  // always reads the answer in the language they wrote in.
  const templates = REPLY_TEMPLATES[p.detected_language];
  const fraud = isFraud(p.dispute_category);
  const deadline = sla.deadline_days;
  const dayUnit =
    deadline === 1 ? templates.dayUnit.one : templates.dayUnit.many;
  const category =
    p.dispute_category === "P2P_BENEFICIARY_NOT_CREDITED"
      ? templates.category.p2p
      : templates.category.p2m;
  let steps: string[];
  if (fraud)
    steps = [
      templates.fraud.report,
      templates.fraud.cybercrime,
      p.utr_number
        ? fill(templates.fraud.dispute, { utr: p.utr_number })
        : templates.fraud.disputeNoUtr,
      templates.fraud.noGuarantee,
    ];
  else if (deadline)
    steps = [
      p.utr_number
        ? fill(templates.technical.verify, { utr: p.utr_number })
        : templates.technical.verifyNoUtr,
      fill(templates.technical.tat, {
        category,
        deadline,
        dayUnit,
      }),
      sla.estimated_compensation_inr === null
        ? templates.technical.compensationUnknown
        : sla.estimated_compensation_inr === 0
          ? fill(templates.technical.compensationNone, { deadline })
          : fill(templates.technical.compensationEstimate, {
              compensation: sla.estimated_compensation_inr,
            }),
      templates.technical.complain,
    ];
  else if (p.dispute_category === "VOLUNTARY_WRONG_VPA_TRANSFER")
    steps = [
      templates.voluntary.notify,
      templates.voluntary.noGuarantee,
      templates.voluntary.keep,
    ];
  else steps = [...templates.generic];
  if (!p.utr_number && p.dispute_category !== "NEEDS_INFORMATION")
    steps.push(templates.askForUtr);
  if (needsPolicyRevalidation) steps.push(templates.policyRevalidation);
  const escalation = templates.escalation;
  return {
    introduction: templates.intro,
    steps,
    escalation,
    text: [
      templates.intro,
      ...steps.map((s, i) => `${i + 1}. ${s}`),
      escalation,
    ].join("\n\n"),
  };
}

export function triage(raw: TriageInput) {
  const start = performance.now();
  const input = inputSchema.parse(raw);
  const privacy = redactPII(input.message);
  const text = privacy.sanitized;
  const warnings: string[] = [];
  const evidence: Evidence[] = [];
  const refs = [...new Set(privacy.anchors.map((a) => a.replacement))];
  const utr = refs.length === 1 ? refs[0] : null;
  if (refs.length > 1)
    warnings.push(
      "Multiple transaction references found; select the disputed transaction before extraction.",
    );
  if (!utr)
    warnings.push(
      "A unique labelled 12-digit UTR/RRN is required for transaction verification.",
    );
  if (utr) {
    const a = privacy.anchors.find((a) => a.replacement === utr)!;
    evidence.push({
      field: "utr_number",
      value: utr,
      source: "customer_message",
      start: a.start,
      end: a.end,
    });
  }
  const amountScan = findAmounts(input.message);
  const uniqueAmounts = [...new Set(amountScan.hits.map(hit => hit.value))];
  const amount = !amountScan.invalid && uniqueAmounts.length === 1 ? uniqueAmounts[0] : null;
  if (amountScan.invalid) warnings.push("An amount has an invalid format or precision; confirm it from the transaction receipt.");
  if (uniqueAmounts.length > 1)
    warnings.push("Conflicting amounts found; human confirmation is required.");
  if (amount)
    evidence.push({
      field: "amount_inr",
      value: amount,
      source: "customer_message",
      start: amountScan.hits.find(hit => hit.value === amount)?.start,
      end: amountScan.hits.find(hit => hit.value === amount)?.end,
    });
  const delayHints = [...asciiDigits(text).matchAll(/\b(\d+)\s*working\s*days?\b/gi)].map(m => Number(m[1]));
  const validHints = [...new Set(delayHints.filter(n => Number.isSafeInteger(n) && n >= 0 && n <= 3650))];
  const delayConflict = validHints.length > 1 || delayHints.some(n => !Number.isSafeInteger(n) || n > 3650) || (input.reporting_delay_working_days != null && validHints.length === 1 && validHints[0] !== input.reporting_delay_working_days);
  const days = delayConflict ? null : input.reporting_delay_working_days ?? validHints[0] ?? null;
  if(delayConflict) warnings.push("Reporting-delay evidence conflicts or is out of range; bank verification is required.");
  if (days !== null)
    evidence.push({
      field: "reporting_delay_working_days",
      value: days,
      source:
        input.reporting_delay_working_days == null
          ? "customer_message"
          : "operator_context",
    });
  const category = classify(text);
  let tier: Payload["rbi_liability_tier"] = "PENDING_VERIFICATION";
  const actions: Payload["mandatory_actions"] = ["CONTACT_BANK_PSP"];
  let deadline: number | null = null;
  if (
    category === "P2M_CONFIRMATION_FAILURE" ||
    category === "P2P_BENEFICIARY_NOT_CREDITED"
  ) {
    deadline = category === "P2M_CONFIRMATION_FAILURE" ? 5 : 1;
    tier = deadline === 5 ? "TECHNICAL_T_PLUS_5" : "TECHNICAL_T_PLUS_1";
    actions.push("RAISE_APP_DISPUTE", "TRACK_REVERSAL");
    if (
      input.elapsed_calendar_days != null &&
      input.elapsed_calendar_days > deadline
    )
      actions.push("REVIEW_COMPENSATION");
  } else if (isFraud(category)) {
    actions.push(
      "SECURE_PAYMENT_CHANNEL",
      "CALL_1930",
      "REPORT_CYBERCRIME",
      "RAISE_APP_DISPUTE",
      "HUMAN_REVIEW",
    );
    if (input.responsibility === "bank") tier = "ZERO_LIABILITY_ELIGIBLE";
    else if (input.responsibility === "customer")
      tier = "CUSTOMER_NEGLIGENCE_REVIEW";
    else if (input.responsibility === "third_party" && days !== null)
      tier =
        days <= 3
          ? "ZERO_LIABILITY_ELIGIBLE"
          : days <= 7
            ? "LIMITED_LIABILITY_ELIGIBLE"
            : "BANK_POLICY_REVIEW";
    else
      warnings.push(
        "Responsibility/authorisation is unverified. Reporting within 3 working days alone does not establish zero liability.",
      );
  } else if (category === "VOLUNTARY_WRONG_VPA_TRANSFER") {
    tier = "BANK_POLICY_REVIEW";
    actions.push("HUMAN_REVIEW");
  } else {
    actions.push("REQUEST_TRANSACTION_DETAILS", "HUMAN_REVIEW");
  }
  if (delayConflict && isFraud(category)) tier = "PENDING_VERIFICATION";
  for (const field of ["responsibility", "account_tier", "elapsed_calendar_days", "transaction_date"] as const) {
    const value = input[field];
    if (value != null && value !== "unknown") evidence.push({ field, value, source: "operator_context" });
  }
  const postPolicy =
    input.transaction_date != null && input.transaction_date >= "2027-01-01";
  if (postPolicy) {
    // The amendment changes the liability rules, so no tier survives unverified
    // for a transaction dated on or after the effective date.
    tier = "PENDING_VERIFICATION";
    warnings.push(
      "Transactions from 1 January 2027 require policy revalidation under the upcoming RBI amendment.",
    );
  }
  if (!utr) actions.push("REQUEST_UTR");
  const payload = payloadSchema.parse({
    utr_number: utr,
    dispute_category: category,
    amount_inr: amount,
    reporting_delay_working_days: days,
    rbi_liability_tier: tier,
    mandatory_actions: actions,
    detected_language:
      input.language === "auto" ? detectLanguage(text) : input.language,
    panic_severity:
      /!!|please\s*help|jaldi|panic|bachao|madad|urgent|90,000|90000|help me/i.test(
        text,
      )
        ? "HIGH_CRITICAL"
        : isFraud(category)
          ? "MEDIUM"
          : "LOW",
  });
  const caps = { unknown: null, bsbd: 5000, regular: 10000, other: 25000 } as const;
  const tierCap = caps[input.account_tier];
  const liabilityCap =
    tier === "LIMITED_LIABILITY_ELIGIBLE" && tierCap !== null
      ? amount !== null
        ? Math.min(amount, tierCap)
        : tierCap
      : null;
  const sla = {
    deadline_days: deadline,
    deadline_day_basis: deadline ? ("calendar" as const) : null,
    reporting_delay_day_basis: "working" as const,
    elapsed_calendar_days: input.elapsed_calendar_days ?? null,
    estimated_compensation_inr:
      deadline && input.elapsed_calendar_days != null
        ? Math.max(0, input.elapsed_calendar_days - deadline) * 100
        : null,
    liability_cap_inr: liabilityCap,
    liability_cap_basis:
      liabilityCap === null
        ? (null as null)
        : amount !== null
          ? ("amount_and_cap" as const)
          : ("cap_only" as const),
    policy_revalidation_required: postPolicy,
  };
  const reply = draftReply(payload, sla, postPolicy);
  const policy = policyCheck(reply.text, payload);
  // Ground the reference in the source message itself, not in the set it came
  // from: the recorded offsets must actually contain the claimed UTR.
  const utrAnchor = utr
    ? privacy.anchors.find((a) => a.replacement === utr)
    : undefined;
  const utrGrounded =
    utr === null
      ? null
      : utrAnchor !== undefined &&
          asciiDigits(input.message.slice(utrAnchor.start, utrAnchor.end)) === utr &&
          /^\d{12}$/.test(utr);
  return {
    payload,
    reply,
    privacy,
    evidence,
    warnings,
    sla,
    audit: {
      policy_version: POLICY_VERSION,
      mode: "deterministic_preview" as const,
      schema_valid: true,
      utr_grounded: utrGrounded,
      ...policy,
      pii_backend: privacy.backend,
      external_actions_taken: false,
      elapsed_ms: Math.round((performance.now() - start) * 100) / 100,
      source_ids: [
        "rbi-liability-2017",
        "rbi-tat-2019",
        "npci-redressal",
        "i4c-report",
        "rbi-ios-2026",
        ...(postPolicy ? ["rbi-amendment-2027"] : []),
      ],
    },
  };
}
export type TriageResult = ReturnType<typeof triage>;
