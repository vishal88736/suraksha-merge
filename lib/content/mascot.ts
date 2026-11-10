/**
 * The desk mascot.
 *
 * The mascot is a guide, not a decoration: every line it says is selected
 * from data based on what the operator is looking at. Its copy is localised
 * like everything else.
 */
import type { LocalizedText } from "../i18n/locales.ts";
import type { TriageState } from "../triage-reducer.ts";

export type MascotMood = "idle" | "listening" | "thinking" | "found" | "warning";

export type MascotHint = {
  id: string;
  mood: MascotMood;
  title: LocalizedText;
  body: LocalizedText;
};

/** Hints in priority order; the first match wins. */
const HINTS: MascotHint[] = [
  {
    id: "fraud",
    mood: "warning",
    title: { en: "Treat this as fraud first", hi: "इसे पहले धोखाधड़ी मानें" },
    body: {
      en: "Report to the bank and call 1930 before anything else. No refund can be promised here, and the reporting window is already running.",
      hi: "सबसे पहले बैंक को सूचना दें और 1930 पर call करें। यहाँ किसी रिफ़ंड का वादा नहीं किया जा सकता, और रिपोर्ट की समय-सीमा चल रही है।",
    },
  },
  {
    id: "technical",
    mood: "found",
    title: { en: "A deadline is running", hi: "एक समय-सीमा चल रही है" },
    body: {
      en: "This is a failed transaction, so RBI fixes a reversal date. Ask the bank for the status first and keep the acknowledgement.",
      hi: "यह विफल लेनदेन है, इसलिए RBI उलटी तारीख़ तय करता है। पहले बैंक से स्थिति पूछें और acknowledgement सहेज कर रखें।",
    },
  },
  {
    id: "wrong-transfer",
    mood: "warning",
    title: { en: "No automatic reversal here", hi: "यहाँ स्वतः उलटी कार्रवाई नहीं" },
    body: {
      en: "A transfer you sent yourself has no refund guarantee. Recovery depends on the bank's review and the recipient's cooperation.",
      hi: "आपके द्वारा भेजे गए ट्रांसफ़र का कोई रिफ़ंड गारंटी नहीं है। वसूली बैंक की समीक्षा और प्राप्तकर्ता के सहयोग पर निर्भर है।",
    },
  },
  {
    id: "needs-information",
    mood: "idle",
    title: { en: "Ask for the receipt details", hi: "रसीद के विवरण माँगें" },
    body: {
      en: "There is not enough to triage yet. A labelled 12-digit UTR or RRN plus the amount and date is enough to start.",
      hi: "अभी ट्रायेज के लिए पर्याप्त जानकारी नहीं है। लेबल किया गया 12-अंकों का UTR या RRN, राशि और तारीख़ — इसी से शुरुआत हो जाती है।",
    },
  },
  {
    id: "missing-reference",
    mood: "thinking",
    title: { en: "Find the labelled UTR", hi: "लेबल वाला UTR ढूँढें" },
    body: {
      en: "The number was found but not labelled, so it is masked as a possible identity. Ask the customer for the UTR or RRN written on the receipt.",
      hi: "संख्या मिली पर लेबल नहीं था, इसलिए उसे संभावित पहचान मानकर छिपा दिया गया है। ग्राहक से रसीद पर लिखा UTR या RRN माँगें।",
    },
  },
  {
    id: "ready",
    mood: "found",
    title: { en: "Ready when you are", hi: "जब आप तैयार हों, मैं हाज़िर हूँ" },
    body: {
      en: "Run the triage and I will extract the fields, check the policy and draft a reply in the customer's own language.",
      hi: "ट्रायेज चलाइए, मैं फ़ील्ड निकालूँगा, नीति जाँचूँगा और ग्राहक की अपनी भाषा में उत्तर तैयार करूँगा।",
    },
  },
  {
    id: "editing",
    mood: "thinking",
    title: { en: "The panel is behind your edit", hi: "पैनल आपके बदलाव से पुराना है" },
    body: {
      en: "The result on the right describes the message you ran, not the text in the box. Run the triage again to refresh it.",
      hi: "दाईं ओर का परिणाम उस संदेश का है जो आपने चलाया था, बॉक्स में लिखे पाठ का नहीं। इसे ताज़ा करने के लिए फिर से ट्रायेज चलाइए।",
    },
  },
  {
    id: "start",
    mood: "idle",
    title: { en: "Hello. I watch the evidence.", hi: "नमस्ते। मैं प्रमाण पर नज़र रखता हूँ।" },
    body: {
      en: "Paste or dictate a customer message in any supported language. I will mask the personal details, extract only what the text supports, and never promise a refund.",
      hi: "किसी भी समर्थित भाषा में ग्राहक संदेश चिपकाएँ या बोलकर लिखवाएँ। मैं व्यक्तिगत विवरण छिपाऊँगा, केवल प्रमाणित फ़ील्ड निकालूँगा, और कभी रिफ़ंड का वादा नहीं करूँगा।",
    },
  },
];

export const MASCOT_NAME = "Sūrakṣha";

export const MASCOT_TAGS: { id: MascotMood; label: LocalizedText }[] = [
  { id: "idle", label: { en: "Ready", hi: "तैयार" } },
  { id: "listening", label: { en: "Listening", hi: "सुन रहा है" } },
  { id: "thinking", label: { en: "Thinking", hi: "सोच रहा है" } },
  { id: "found", label: { en: "Found", hi: "मिल गया" } },
  { id: "warning", label: { en: "Attention", hi: "ध्यान दें" } },
];

/**
 * Choose the hint that matches what the operator is looking at. The order
 * mirrors how much the operator needs to know right now.
 */
export function mascotHintFor(
  state: TriageState,
  options: { listening?: boolean; running?: boolean } = {},
): MascotHint {
  const byId = (id: string) => HINTS.find((hint) => hint.id === id)!;
  if (options.listening) return byId("start");
  const category = state.result.payload.dispute_category;
  if (category === "COLLECT_REQUEST_SCAM" || category === "REMOTE_ACCESS_SCAM")
    return byId("fraud");
  if (category === "UNAUTHORIZED_ACCOUNT_TAKEOVER") return byId("fraud");
  if (category === "VOLUNTARY_WRONG_VPA_TRANSFER") return byId("wrong-transfer");
  if (
    category === "P2M_CONFIRMATION_FAILURE" ||
    category === "P2P_BENEFICIARY_NOT_CREDITED"
  )
    return byId("technical");
  if (category === "NEEDS_INFORMATION" && state.result.payload.utr_number === null)
    return byId("missing-reference");
  if (category === "NEEDS_INFORMATION") return byId("needs-information");
  if (state.status === "dirty") return byId("editing");
  if (state.submittedMessage.trim().length === 0) return byId("start");
  return byId("ready");
}
