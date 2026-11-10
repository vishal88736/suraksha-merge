/**
 * The research pipeline, described as data.
 *
 * Each stage carries the command that produces it and the outputs it must
 * yield. The prose is localised; the kit names, commands and icon keys are
 * identifiers, not copy.
 */
import type { LocalizedText } from "../i18n/locales.ts";

export type StageIcon = "database" | "layers" | "merge" | "file-check";

export type PipelineStage = {
  id: string;
  kit: string;
  icon: StageIcon;
  color: "orange" | "teal" | "violet" | "blue";
  name: LocalizedText;
  text: LocalizedText;
  details: LocalizedText;
  outputs: LocalizedText[];
  status: LocalizedText;
  path: string;
};

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "curate",
    kit: "CuratorKIT",
    icon: "database",
    color: "orange",
    name: { en: "Curate with care", hi: "सावधानी से संचयन" },
    text: {
      en: "Two datasets. One chain of evidence.",
      hi: "दो डेटासेट। एक प्रमाण-श्रृंखला।",
    },
    details: {
      en: "Start with synthetic or authorised customer chats. Mask sensitive identities, retain only context-labelled transaction references, validate fields against source spans, and separate schema targets from same-task preference pairs.",
      hi: "सिंथेटिक या अधिकृत ग्राहक चैट से शुरू करें। संवेदनशील पहचान छिपाएँ, केवल संदर्भ-लेबल वाले लेनदेन संदर्भ रखें, स्रोत अंशों के विरुद्ध फ़ील्ड सत्यापित करें, और स्कीमा लक्ष्यों को समान-कार्य वरीयता जोड़ों से अलग रखें।",
    },
    outputs: [
      {
        en: "Dataset A · strict JSON + field provenance",
        hi: "डेटासेट A · कठोर JSON + फ़ील्ड प्रमाण",
      },
      {
        en: "Dataset B · chosen / rejected customer replies",
        hi: "डेटासेट B · चुने हुए / अस्वीकृत ग्राहक उत्तर",
      },
      {
        en: "Manifest · source hashes, split IDs and rejection reasons",
        hi: "मैनिफ़ेस्ट · स्रोत हैश, विभाजन ID और अस्वीकृति कारण",
      },
    ],
    status: {
      en: "Local curation + optional CuratorKIT pass",
      hi: "स्थानीय संचयन + वैकल्पिक CuratorKIT पास",
    },
    path: "python3 phase1_curatorkit_pipeline.py --demo",
  },
  {
    id: "train",
    kit: "AlignTune",
    icon: "layers",
    color: "teal",
    name: { en: "Train specialists", hi: "विशेषज्ञ प्रशिक्षित करें" },
    text: {
      en: "Give each task room to learn.",
      hi: "हर कार्य को सीखने की जगह दें।",
    },
    details: {
      en: "Train schema extraction with verifiable rewards and customer replies with DPO. Both specialists must share the same model, vocabulary, embedding checkpoint and LoRA target modules. Tokenizer expansion requires real embedding adaptation before either specialist is trained.",
      hi: "स्कीमा निष्कर्ष सत्यापन योग्य पुरस्कारों से और ग्राहक उत्तर DPO से प्रशिक्षित करें। दोनों विशेषज्ञों को एक ही मॉडल, शब्दावली, एम्बेडिंग चेकपॉइंट और LoRA लक्ष्य मॉड्यूल साझा करने होंगे। किसी भी विशेषज्ञ के प्रशिक्षण से पहले टोकनाइज़र विस्तार के लिए वास्तविक एम्बेडिंग अनुकूलन आवश्यक है।",
    },
    outputs: [
      { en: "Adapter A · Dr. GRPO schema specialist", hi: "अडैप्टर A · Dr. GRPO स्कीमा विशेषज्ञ" },
      {
        en: "Adapter B · DPO policy and language specialist",
        hi: "अडैप्टर B · DPO नीति और भाषा विशेषज्ञ",
      },
      {
        en: "Controls · base, uncurated SFT and curated joint SFT",
        hi: "नियंत्रण · base, अअसंकलित SFT और संकलित संयुक्त SFT",
      },
    ],
    status: {
      en: "Requires compatible GPU + reviewed data",
      hi: "संगत GPU + समीक्षित डेटा आवश्यक",
    },
    path: "python3 phase2_aligntune_train_and_merge.py --stage plan",
  },
  {
    id: "merge",
    kit: "Task arithmetic",
    icon: "merge",
    color: "violet",
    name: { en: "Merge & investigate", hi: "मर्ज करें और जाँचें" },
    text: {
      en: "A hypothesis, ready to be tested.",
      hi: "एक परिकल्पना, जाँच के लिए तैयार।",
    },
    details: {
      en: "Compose the weighted parameter updates using a compatible LoRA merge. Sweep weights on validation data, including the two unmerged specialists. Moving the slider configures an experiment; it does not change this rule-based preview or demonstrate model quality.",
      hi: "संगत LoRA मर्ज से भारित पैरामीटर अपडेट को संयोजित करें। सत्यापन डेटा पर वज़न sweep करें, जिसमें दोनों अनमर्ज विशेषज्ञ शामिल हैं। स्लाइडर चलाना केवल प्रयोग कॉन्फ़िगर करता है; यह इस नियम-आधारित पूर्वावलोकन को नहीं बदलता और मॉडल की गुणवत्ता प्रमाणित नहीं करता।",
    },
    outputs: [
      { en: "ΔW = λA · ΔWA + λB · ΔWB", hi: "ΔW = λA · ΔWA + λB · ΔWB" },
      {
        en: "Validation sweep · weights selected before held-out test",
        hi: "सत्यापन sweep · होल्ड-आउट टेस्ट से पहले वज़न चुने गए",
      },
      {
        en: "Merge manifest · base, tokenizer and adapter identities",
        hi: "मर्ज मैनिफ़ेस्ट · base, टोकनाइज़र और अडैप्टर पहचान",
      },
    ],
    status: {
      en: "Configuration preview · no merged checkpoint yet",
      hi: "कॉन्फ़िगरेशन पूर्वावलोकन · अभी कोई मर्ज चेकपॉइंट नहीं",
    },
    path: "python3 phase2_aligntune_train_and_merge.py --stage merge",
  },
  {
    id: "audit",
    kit: "AuditKIT",
    icon: "file-check",
    color: "blue",
    name: { en: "Make quality visible", hi: "गुणवत्ता को दिखाएँ" },
    text: {
      en: "Every claim needs a measured result.",
      hi: "हर दावे को मापा गया परिणाम चाहिए।",
    },
    details: {
      en: "Compare all six checkpoints on held-out scenario groups. Score the full JSON schema, all extracted fields, inappropriate guarantees and required actions. Keep human-rated empathy separate from lexical ChrF, and use paired bootstrap intervals rather than treating a single percentage as proof.",
      hi: "सभी छह चेकपॉइंट की तुलना होल्ड-आउट परिदृश्य समूहों पर करें। पूरा JSON स्कीमा, सभी निकाले गए फ़ील्ड, अनुपचित वादे और आवश्यक कार्रवाइयाँ स्कोर करें। मानव-रेट की गई सहानुभूति को शब्द-सीमित ChrF से अलग रखें, और किसी एक प्रतिशत को प्रमाण मानने के बजाय युग्मित बूटस्ट्रैप अंतरालों का उपयोग करें।",
    },
    outputs: [
      {
        en: "Ablation · 6 named checkpoints with run fingerprints",
        hi: "अब्लेशन · 6 नामित चेकपॉइंट, run फ़िंगरप्रिंट के साथ",
      },
      {
        en: "Red team · coercion, injection and over-refusal cases",
        hi: "रेड टीम · दबाव, इंजेक्शन और अति-अस्वीकार मामले",
      },
      {
        en: "Report · per-case evidence + paired bootstrap deltas",
        hi: "रिपोर्ट · प्रति-मामला प्रमाण + युग्मित बूटस्ट्रैप अंतर",
      },
    ],
    status: {
      en: "Offline scorer ready · model evaluation pending",
      hi: "ऑफ़लाइन स्कोरर तैयार · मॉडल मूल्यांकन लंबित",
    },
    path: "python3 phase3_auditkit_eval.py --help",
  },
];

/** The checkpoints the benchmark lab tracks, in ablation order. */
export const BENCHMARK_CHECKPOINTS = [
  "Base Qwen2.5-3B",
  "Uncurated multitask SFT",
  "Curated monolithic SFT",
  "Adapter A · schema RLVR",
  "Adapter B · empathy DPO",
  "Suraksha-Merge · A + B",
] as const;
