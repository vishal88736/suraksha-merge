/**
 * Second set of varied-wording training candidates, for the cases user-style
 * testing found the round-3 model getting wrong: billers and apps, declined
 * or "not placed" payments, bare amounts ("Paid 1,850"), an OTP or PIN given
 * to a caller, a QR scanned "to receive money", generic purchase words with a
 * person as the recipient, plus hard negatives.
 *
 *   node scripts/author_variations_v2.ts > data/review/variation_queue.v2.jsonl
 *
 * As in author_variations.ts: the category is the author's, every other label
 * comes from the policy rules for that category, and nothing is human-reviewed
 * until scripts/prepare_review.py / research/human_review.py records a decision.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { triage } from "../lib/engine.ts";
import type { TriageInput } from "../lib/engine.ts";

type Lang = "english" | "hinglish" | "hindi_devanagari";
type Cat =
  | "P2M_CONFIRMATION_FAILURE"
  | "P2P_BENEFICIARY_NOT_CREDITED"
  | "COLLECT_REQUEST_SCAM"
  | "REMOTE_ACCESS_SCAM"
  | "UNAUTHORIZED_ACCOUNT_TAKEOVER"
  | "VOLUNTARY_WRONG_VPA_TRANSFER"
  | "NEEDS_INFORMATION";

// {amt} is a currency amount, {bare} the same number without a currency mark.
const TEXT: Record<Cat, Record<Lang, string[]>> = {
  P2M_CONFIRMATION_FAILURE: {
    english: [
      "Paid {bare} for the electricity bill in the biller section, it has been pending since and the money left my account.{utr}",
      "Booked an Uber, the app said payment declined but {amt} got debited anyway.{utr}",
      "My DTH recharge didn't go through, still {bare} was deducted from savings.{utr}",
      "Flipkart says order not placed after I paid, my account was debited {bare}.{utr}",
    ],
    hinglish: [
      "Bijli ka bill bhara, {bare} kat gaye par bill abhi bhi unpaid dikha raha hai.{utr}",
      "Ola ride ka payment declined aaya lekin {amt} debit ho gaye.{utr}",
      "Broadband bill pay kiya, transaction unsuccessful bola par {amt} chale gaye.{utr}",
      "Amazon pe order place nahi hua, phir bhi {bare} kat gaye account se.{utr}",
    ],
    hindi_devanagari: [
      "बिजली का बिल भरा, {amt} कट गए पर बिल अब भी बकाया दिख रहा है।{utr}",
      "DTH रिचार्ज नहीं हुआ लेकिन {amt} कट गए।{utr}",
      "ऑर्डर प्लेस नहीं हुआ, फिर भी दुकान के भुगतान में खाते से {amt} कट गए।{utr}",
      "ओला राइड का भुगतान अस्वीकार हुआ पर {amt} कट गए।{utr}",
    ],
  },
  P2P_BENEFICIARY_NOT_CREDITED: {
    english: [
      "Split the dinner bill with my roommate and sent him {amt}, he has not received it.{utr}",
      "Sent {bare} to my brother for his exam fees, the transfer is stuck and he didn't get it.{utr}",
      "Transferred {bare} to my landlord, it shows pending and the recipient has not got it.{utr}",
    ],
    hinglish: [
      "Dost ke saath bill split kiya, usko {amt} bheje par usko mile nahi.{utr}",
      "Bhai ki fees ke liye {bare} transfer kiye, wo bol raha paise nahi pahunche.{utr}",
      "Roommate ko ticket ke {amt} bheje, transfer pending hai, usko credit nahi hua.{utr}",
    ],
    hindi_devanagari: [
      "दोस्त के साथ बिल बाँटा, उसे {amt} भेजे पर उसे पैसे नहीं मिले।{utr}",
      "भाई की फीस के लिए {amt} ट्रांसफर किए, वह कह रहा है पैसे नहीं पहुँचे।{utr}",
      "रूममेट को टिकट के {amt} भेजे, ट्रांसफर अटका है और उसे पैसे नहीं मिले।{utr}",
    ],
  },
  COLLECT_REQUEST_SCAM: {
    english: [
      "A buyer for my old cycle sent a QR and said scan it to receive the money, I did and {amt} left my account.{utr}",
      "Was told to scan a QR to get my payment for the sofa I listed, instead {bare} got debited.{utr}",
    ],
    hinglish: [
      "Purana phone bechne ke liye buyer ne QR bheja, bola scan karo paise receive karne ke liye, ulta {amt} kat gaye.{utr}",
      "OLX buyer ka QR scan kiya payment lene ke liye, {amt} mere account se chale gaye.{utr}",
    ],
    hindi_devanagari: [
      "पुराना फ़ोन बेचा, खरीदार ने QR भेजकर कहा स्कैन करो पैसे पाने के लिए, उल्टा {amt} कट गए।{utr}",
      "QR स्कैन किया पैसे लेने के लिए, पर {amt} मेरे खाते से कट गए।{utr}",
    ],
  },
  REMOTE_ACCESS_SCAM: {
    english: ["Caller said my KYC would lapse and got me to install an app, then {amt} was debited.{utr}"],
    hinglish: ["KYC ke naam pe ek app download karwaya, phir {amt} kat gaye.{utr}"],
    hindi_devanagari: ["KYC के नाम पर ऐप डाउनलोड करवाया, फिर {amt} कट गए।{utr}"],
  },
  UNAUTHORIZED_ACCOUNT_TAKEOVER: {
    english: [
      "A man claiming to be from my bank's KYC team got me to read out the OTP, minutes later {amt} was debited.{utr}",
      "I gave the OTP to a caller who said my reward points would expire, then {bare} got deducted.{utr}",
      "Shared my UPI PIN with someone on a customer care call and {amt} went out.{utr}",
    ],
    hinglish: [
      "Bank wala bankar call aaya, maine OTP bata diya, uske baad {amt} nikal gaye.{utr}",
      "Reward points ke naam pe OTP maanga, maine de diya, {bare} kat gaye.{utr}",
      "Customer care ko UPI PIN share kiya aur {amt} chale gaye.{utr}",
    ],
    hindi_devanagari: [
      "बैंक के नाम से कॉल आया, मैंने OTP बता दिया, फिर {amt} कट गए।{utr}",
      "कॉल करने वाले को UPI PIN दे दिया और {amt} निकल गए।{utr}",
    ],
  },
  VOLUNTARY_WRONG_VPA_TRANSFER: {
    english: ["I sent {bare} to the wrong UPI ID by mistake and the person is not returning it.{utr}"],
    hinglish: ["Galti se {bare} bhej diye kisi aur ke UPI ID pe, wo wapas nahi kar raha.{utr}"],
    hindi_devanagari: ["गलती से गलत UPI ID पर {amt} भेज दिए, वह लौटा नहीं रहा।{utr}"],
  },
  NEEDS_INFORMATION: {
    english: [
      "Bank sent me an OTP though I didn't start any payment, nothing was debited. Is my account safe?",
      "Paid the electricity bill 3 days ago, how long does the receipt usually take?",
    ],
    hinglish: ["Bina kuch kiye OTP aaya, paise nahi kate, kya karun?"],
    hindi_devanagari: ["बिना कुछ किए OTP आया, पैसे नहीं कटे, क्या करूँ?"],
  },
};

const FRAUD: Cat[] = ["COLLECT_REQUEST_SCAM", "REMOTE_ACCESS_SCAM", "UNAUTHORIZED_ACCOUNT_TAKEOVER"];
const RESPONSIBILITY = ["unknown", "third_party", "customer"] as const;
const DELAYS = [null, 0, 2, 5] as const;
const ELAPSED = [null, 1, 4, 8] as const;
const AMOUNT_STYLE = [(n: number) => `₹${n.toLocaleString("en-IN")}`, (n: number) => `Rs ${n}`, (n: number) => `${n} rupaye`];
const UTR_STYLE = [(u: string) => ` UTR ${u}`, (u: string) => ` RRN ${u}`, () => ""];
const REJECTED: Record<Lang, string> = {
  english: "Your refund is 100% guaranteed. The dispute is already filed and a full reversal is approved.",
  hinglish: "Aapka refund 100% guaranteed hai. Dispute already filed hai aur full reversal approved hai.",
  hindi_devanagari: "आपका रिफंड 100% गारंटी के साथ मंजूर है। refund approved है और dispute already filed है।",
};

// Wording must not overlap the challenge set or the first variation set.
const trigrams = (s: string) => {
  const t = s.toLowerCase().replace(/\s+/g, " ");
  return new Set(Array.from({ length: Math.max(0, t.length - 2) }, (_, i) => t.slice(i, i + 3)));
};
const lines = (f: string) => fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const heldOut = lines("data/challenge/category-challenge-v1.jsonl").map((r) => trigrams(r.message));
const earlier = lines("data/review/variation_queue.v1.jsonl").map((r) => trigrams(r.complaint_text));
const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let serial = 0;
const out: unknown[] = [];
for (const [category, byLang] of Object.entries(TEXT) as [Cat, Record<Lang, string[]>][]) {
  for (const [language, texts] of Object.entries(byLang) as [Lang, string[]][]) {
    texts.forEach((template, k) => {
      serial++;
      const amount = 240 + ((serial * 211) % 37) * 310;
      const utr = `82000${String(500000 + serial).padStart(7, "0")}`;
      const message = template
        .replace("{amt}", language === "hindi_devanagari" && serial % 3 === 2 ? `${amount} रुपये` : AMOUNT_STYLE[serial % 3](amount))
        .replace("{bare}", amount.toLocaleString("en-IN"))
        .replace("{utr}", UTR_STYLE[serial % 3](utr));
      const t = trigrams(message);
      if (Math.max(...heldOut.map((c) => jaccard(t, c))) > 0.6) throw new Error(`too close to the challenge set: ${message}`);
      if (Math.max(...earlier.map((c) => jaccard(t, c))) > 0.6) throw new Error(`too close to variation set v1: ${message}`);
      const input: TriageInput = { message, language };
      if (FRAUD.includes(category)) {
        // Sharing an OTP or PIN is the customer's own act; nothing else is assumed.
        const shared = /otp|pin/i.test(message);
        input.responsibility = shared ? "customer" : RESPONSIBILITY[serial % 3];
        const delay = DELAYS[serial % 4];
        if (delay !== null) input.reporting_delay_working_days = delay;
      }
      if (category === "P2M_CONFIRMATION_FAILURE" || category === "P2P_BENEFICIARY_NOT_CREDITED") {
        const elapsed = ELAPSED[serial % 4];
        if (elapsed !== null) input.elapsed_calendar_days = elapsed;
      }
      const result = triage(input, { category });
      const id = `var2-${category.toLowerCase().replace(/_/g, "-")}-${language}-${k}`;
      // A scenario group (category, k) spans languages, so its split must be
      // the same in every language: case 1 of the three larger categories.
      const split = k === 1 && ["P2M_CONFIRMATION_FAILURE", "P2P_BENEFICIARY_NOT_CREDITED", "UNAUTHORIZED_ACCOUNT_TAKEOVER"].includes(category) ? "validation" : "train";
      const provenance = {
        sample_id: id, scenario_group: `variation2:${category.toLowerCase()}:${k}`, split,
        origin: "authored_variation", human_reviewed: false, label_status: "authored_variation_unreviewed",
        source_provenance: null, synthetic_status: "hand_written_variation", generator_version: "author_variations.v2",
        label_basis: "author category; facts, tier, actions, panic and reply from policy rules for that category",
        policy_version: result.audit.policy_version, sanitized_sha256: sha(result.privacy.sanitized),
      };
      out.push({
        review_id: id, scenario_group: provenance.scenario_group, split, origin: "authored_variation",
        review_type: "annotation", priority: FRAUD.includes(category) ? 7 : 4,
        priority_reasons: ["authored_variation", ...(FRAUD.includes(category) ? ["fraud_policy_risk"] : [])],
        input, complaint_text: message, expected_json: result.payload, chosen_reply: result.reply.text,
        rejected_reply: REJECTED[language], provenance, review_status: "pending",
        required_reviews: ["classification", "json_ground_truth", "language_quality", "rbi_policy_guidance", "dpo_preference"],
        decisions: [],
      });
    });
  }
}
for (const row of out) process.stdout.write(JSON.stringify(row) + "\n");
process.stderr.write(`${out.length} variation candidates written\n`);
