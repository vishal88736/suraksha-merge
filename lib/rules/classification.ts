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

/**
 * Native-script keywords for the most-spoken scheduled languages (Bengali,
 * Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Odia,
 * Hindi). Written by the project, not by native speakers: they need the same
 * native-speaker review as the machine-translated replies. JavaScript \b is
 * ASCII-only, so these are matched as plain substrings.
 */
const NATIVE = {
  fraud:
    "জালিয়াতি|প্রতারণা|প্রতারক|হ্যাক|மோசடி|ஹேக்|మోసం|హ్యాక్|फसवणूक|हॅक|છેતરપિંડી|હેક|ವಂಚನೆ|ಮೋಸ|ಹ್ಯಾಕ್|തട്ടിപ്പ്|ഹാക്ക്|ਧੋਖਾਧੜੀ|ਠੱਗੀ|ਹੈਕ|دھوکہ|فراڈ|ہیک|ପ୍ରତାରଣା|ଠକେଇ|धोखाधड़ी|धोखा|ठगी|फ्रॉड|हैक",
  failed:
    "ব্যর্থ|தோல்வி|విఫల|अयशस्वी|નિષ્ફળ|ವಿಫಲ|പരാജയ|ਫੇਲ੍ਹ|ਅਸਫਲ|ناکام|ବିଫଳ|विफल|असफल|फेल",
  notReceived:
    "পায়নি|পৌঁছায়নি|জমা হয়নি|வரவில்லை|கிடைக்கவில்லை|வரவு வைக்கப்படவில்லை|రాలేదు|అందలేదు|జమ కాలేదు|मिळाले नाही|जमा झाले नाही|પહોંચ્યા નથી|મળ્યા નથી|જમા થયા નથી|ಬಂದಿಲ್ಲ|ತಲುಪಿಲ್ಲ|ಜಮೆ ಆಗಿಲ್ಲ|ലഭിച്ചില്ല|കിട്ടിയില്ല|എത്തിയില്ല|ਨਹੀਂ ਮਿਲੇ|ਨਹੀਂ ਪਹੁੰਚ|نہیں ملے|رقم نہیں ملی|نہیں پہنچ|وصول نہیں|ପାଇନାହାଁନ୍ତି|ପହଞ୍ଚିନାହିଁ|नहीं मिले|पैसे नहीं मिल|रकम नहीं मिल|राशि नहीं मिल|नहीं पहुँच|नहीं पहुंच|जमा नहीं",
  recipient:
    "প্রাপক|பெறுந|గ్రహీత|प्राप्तकर्त|પ્રાપ્તકર્ત|ಸ್ವೀಕರಿಸುವವ|സ്വീകർത്താവ|ਪ੍ਰਾਪਤਕਰਤ|وصول کنندہ|ପ୍ରାପକ|पाने वाले",
  merchant:
    "দোকান|ব্যবসায়ী|கடை|வணிகர்|దుకాణ|వ్యాపారి|दुकान|व्यापारी|દુકાન|વેપારી|ಅಂಗಡಿ|ವ್ಯಾಪಾರಿ|കട|വ്യാപാരി|ਦੁਕਾਨ|ਵਪਾਰੀ|دکان|دکاندار|ଦୋକାନ|ବ୍ୟବସାୟୀ",
  wrong:
    "ভুল|தவறான|తప్పు|चुकीच्या|ખોટા|ತಪ್ಪು|തെറ്റായ|ਗਲਤ|غلط|ଭୁଲ|गलत",
  mistake:
    "ভুল করে|ভুলবশত|தவறுதலாக|పొరపాటున|चुकून|ભૂલથી|ತಪ್ಪಾಗಿ|അബദ്ധത്തിൽ|ਗਲਤੀ ਨਾਲ|غلطی سے|ଭୁଲରେ|गलती से|भूल से",
} as const;
const native = (key: keyof typeof NATIVE) => new RegExp(NATIVE[key], "u");

/** Remote-access tooling: the customer installed something on their device. */
export const REMOTE_ACCESS_SIGNALS =
  /anydesk|\.apk\b|remote\s*access|screen[ -]?shar|teamviewer|quick\s*support|\bapp\s*(?:download|install)\s*(?:karwa|karva|kara|krwa)\w*|(?:made|asked|told|got)\s+me\s+(?:to\s+)?(?:download|install)|ऐप\s*(?:डाउनलोड|इंस्टॉल)\s*(?:करवा|कराया|करने)|ऐप\s*डलवा/i;

/**
 * A collect request needs a market signal: a platform, a buyer or a seller
 * asking for money by QR. "Scanned the shop QR" is a merchant payment.
 */
export const COLLECT_REQUEST_SIGNALS =
  /collect\s*request|advance\s*(?:payment|amount)|\bqr\b[\s\S]{0,60}\b(?:to\s+)?(?:receive|get|accept)\s+(?:the\s+|my\s+)?(?:money|payment|amount|paise)|(?:olx|facebook|instagram|amazon|buyer|seller|receive\s*money|request\s*money)[\s\S]{0,180}\bqr\b|\bqr\b[\s\S]{0,120}\b(?:scam|fraud|fraudster|cheat|phish|advance\s*payment)\b/i;

/** Money left without the customer's consent. */
export const FRAUD_SIGNALS =
  /\b(?:fraud|fraudster|scam(?:mer|mers|med|ming)?|cheat(?:ed|ing)?|phish(?:ing)?|hacked|compromised|unauthori[sz]ed|stolen|framed|impersonat\w*)\b|not\s*me\b|did\s*not\s*(?:make|authori[sz]e|do\s*(?:this|it))|didn[’']?t\s*(?:make|authori[sz]e|do)\s*(?:this|it|any)|bina\s*(?:mere\s*|meri\s*)?permission|without\s*(?:my\s*)?permission|(?:maine|mai\s*ne|main\s*ne)\s*(?:koi|kuch)\s*(?:upi\s*)?(?:transaction|payment)?\s*n(?:a|h)?h?i\s*ki(?:ya)?|अनधिकृत/i;

/**
 * The customer gave a one-time password or PIN to someone else: a social-
 * engineering takeover once money has left ("shared the OTP", "OTP bata diya").
 */
export const CREDENTIAL_SHARED_SIGNALS =
  /\b(?:shared?|gave|give|told|tell|read\s*out|provided?)\b[^.!?\n]{0,40}\b(?:otp|upi\s*pin|m-?pin|pin)\b|\b(?:otp|upi\s*pin|pin)\b[^.!?\n]{0,25}\b(?:bata\s*(?:diya|di|dia)|de\s*(?:diya|di|dia)|share\s*(?:kiya|kar\s*diya|ki))/i;

/** The customer states that they sent the money themselves, by mistake. */
export const WRONG_TRANSFER_SIGNALS =
  /wrong\s*(?:vpa|upi|person|account)|galat\s*(?:vpa|upi|account)|chukichya/i;

/** First-person intent that the transfer was voluntary. */
export const VOLUNTARY_INTENT_SIGNALS =
  /\b(?:voluntarily|by\s*(?:mistake|accident)|my\s*mistake|galti\s*se|wrong\s*(?:vpa|upi|account))\b/i;

/** The transaction did not complete as expected. */
export const TECHNICAL_FAILURE_SIGNALS =
  /not\s*(?:credited|received?|recvd|reached|got)|no\s*got|didn[’']?t\s*(?:get|receive|reach)|did\s*not\s*(?:get|receive|reach)|stuck|pending|failed|declined|(?:payment|transaction|transfer|order)\s+(?:was\s+|is\s+|got\s+)?unsuccessful|(?:did\s*not|didn[’']?t)\s*go\s*through|not\s*(?:placed|completed|successful|processed)|order\s*(?:failed|cancel+ed)|n(?:a|ah)?[hi]i?n?\s*(?:mil[ae]|pahunch[ae]|phuch[ae])|mil[ae]\s*n(?:a|h)?(?:h?i|ai)\b|receive\s*n(?:a)?h?i|illa|debitaachu|confirmation|unconfirmed/i;

/** Merchant or acquiring context. */
export const MERCHANT_SIGNALS =
  /merchant|swiggy|zomato|shop|store|p2m|bigbasket|amazon|flipkart|\buber\b|\bola\b|irctc|dmart|petrol\s*pump|electricity|\bbiller\b|\bdth\b|broadband|\bpremium\b|bijli|gas\s*(?:bill|cylinder|booking)/i;

/**
 * Generic purchase words. They mean a merchant only when no person is named as
 * the recipient: "shared the bill with my friend, he has not received it" is P2P.
 */
export const PURCHASE_SIGNALS =
  /\border\b|\bbill\b|recharge|\bfees?\b|ticket|toll|checkout/i;

/** Peer-to-peer transfer context. */
export const P2P_SIGNALS =
  /transfer|friend|p2p|beneficiary|re[cs]e?ipi?ent|rec\w{0,3}ver|payee|other\s*(?:person|party)|\bbande?y?\b/i;

/**
 * Evidence that money actually left the account. A scam category needs it:
 * "I installed AnyDesk for work, UPI is fine" is not a remote-access scam.
 */
export const LOSS_SIGNALS =
  /debit|deduct|withdr[ae]w|transferred\s*out|\blost\b|\bgone\b|stolen|disappear|taken|\bcut\b|\bkat|gaye|gayi|nikal|\budd|chale|went\s*out|unauthori[sz]ed|fraud|scam|cheat|₹\s*\d|\brs\.?\s*\d|inr\s*\d|कट|निकल|चले\s*गए|কেটে|కట్/i;

/** The customer says no money left the account: nothing to reverse. */
export const NO_DEBIT_SIGNALS =
  /\b(?:before|without)\s+(?:any\s+)?(?:money|amount|funds?|paise|paisa)?\s*(?:was\s+|being\s+|getting\s+|got\s+)?(?:debited|deducted|cut|taken)|\b(?:not|never|no\s+money|nothing)\s+(?:was\s+|got\s+|been\s+|is\s+)?(?:debited|deducted|cut)\b|\bno\s+(?:debit|deduction)\b|\b(?:paise|paisa)\s+(?:nahi|nhi)\s+kat|\bkat[ae]?\s+(?:nahi|nhi)\b|पैसे\s+नहीं\s+कटे/i;

/** The customer says the recipient did get the money. */
export const RECEIVED_OK_SIGNALS =
  /\b(?:friend|recipient|receiver|beneficiary|payee|merchant|shop(?:keeper)?|he|she|they)\s+(?:has\s+|have\s+|had\s+)?(?:received|got)\s+(?:my|the|it|money|payment|transfer|amount)|\b(?:paise|paisa|payment)\s+mil\s+(?:gaye|gaya|gya)\b|\bcredited\s+to\s+(?:him|her|them|the\s+recipient)/i;

export const FRAUD_CATEGORIES: readonly Category[] = [
  "COLLECT_REQUEST_SCAM",
  "REMOTE_ACCESS_SCAM",
  "UNAUTHORIZED_ACCOUNT_TAKEOVER",
];

export function isFraudCategory(category: string): boolean {
  return FRAUD_CATEGORIES.includes(category as Category);
}

function positive(text: string, signal: RegExp): boolean {
  for (const match of text.matchAll(
    new RegExp(signal.source, signal.flags.replace("g", "") + "g"),
  )) {
    const prefix = text.slice(Math.max(0, match.index! - 35), match.index!);
    if (
      !/\b(?:no|not|never|isn[’']?t|wasn[’']?t)\s+(?:(?:a|an|any)\s+)?$/i.test(
        prefix,
      )
    )
      return true;
  }
  return false;
}

export function classify(text: string): Category {
  const loss = LOSS_SIGNALS.test(text);
  if (positive(text, REMOTE_ACCESS_SIGNALS) && loss) return "REMOTE_ACCESS_SCAM";
  if (positive(text, COLLECT_REQUEST_SIGNALS) && loss) return "COLLECT_REQUEST_SCAM";
  // Fraud evidence outranks any benign reading of the same sentence.
  if (
    positive(text, FRAUD_SIGNALS) ||
    native("fraud").test(text) ||
    (loss && positive(text, CREDENTIAL_SHARED_SIGNALS))
  )
    return "UNAUTHORIZED_ACCOUNT_TAKEOVER";
  // A voluntary transfer needs the customer's own statement of intent.
  const wrong = WRONG_TRANSFER_SIGNALS.test(text) || native("wrong").test(text);
  const intent =
    VOLUNTARY_INTENT_SIGNALS.test(text) || native("mistake").test(text);
  if (wrong && intent) return "VOLUNTARY_WRONG_VPA_TRANSFER";
  // A reversal dispute needs money that left and did not arrive.
  const failure =
    (TECHNICAL_FAILURE_SIGNALS.test(text) ||
      native("failed").test(text) ||
      native("notReceived").test(text)) &&
    !NO_DEBIT_SIGNALS.test(text) &&
    !RECEIVED_OK_SIGNALS.test(text);
  if (!failure) return "NEEDS_INFORMATION";
  if (MERCHANT_SIGNALS.test(text) || native("merchant").test(text))
    return "P2M_CONFIRMATION_FAILURE";
  if (P2P_SIGNALS.test(text) || native("recipient").test(text))
    return "P2P_BENEFICIARY_NOT_CREDITED";
  if (PURCHASE_SIGNALS.test(text)) return "P2M_CONFIRMATION_FAILURE";
  return "NEEDS_INFORMATION";
}
