/**
 * Customer reply templates, one bundle per supported reply language.
 *
 * The engine never assembles a sentence itself: it selects a bundle and
 * fills placeholders. That keeps the wording reviewable, translatable and
 * identical between the runtime and the research pipeline.
 *
 * Placeholders: {utr}, {deadline}, {dayUnit}, {category}, {compensation}.
 */
import { OMBUDSMAN_NOTE } from "../policy.ts";
import type { ReplyLanguage } from "./locales.ts";

export type ReplyTemplates = {
  intro: string;
  fraud: {
    report: string;
    cybercrime: string;
    dispute: string;
    disputeNoUtr: string;
    noGuarantee: string;
  };
  technical: {
    verify: string;
    verifyNoUtr: string;
    tat: string;
    compensationUnknown: string;
    compensationNone: string;
    compensationEstimate: string;
    complain: string;
  };
  voluntary: {
    notify: string;
    noGuarantee: string;
    keep: string;
  };
  generic: string[];
  askForUtr: string;
  policyRevalidation: string;
  escalation: string;
  category: { p2m: string; p2p: string };
  dayUnit: { one: string; many: string };
};

export const REPLY_TEMPLATES: Record<ReplyLanguage, ReplyTemplates> = {
  english: {
    intro:
      "I understand how worrying this is. Let’s take this one step at a time.",
    fraud: {
      report:
        "Contact your bank/PSP immediately to report the fraud and secure or block the payment channel. Never share a PIN or OTP.",
      cybercrime:
        "Call 1930 immediately and report at cybercrime.gov.in. Preserve the SMS, screenshots and bank acknowledgement.",
      dispute:
        "Raise a dispute in the PSP app for UTR {utr} and notify your bank.",
      disputeNoUtr:
        "Raise a dispute in the PSP app for this transaction and notify your bank.",
      noGuarantee:
        "A refund or zero liability cannot be confirmed here. The bank must verify authorisation, responsibility and the reporting window.",
    },
    technical: {
      verify:
        "Ask the bank/PSP to verify the transaction status (UTR {utr}).",
      verifyNoUtr: "Ask the bank/PSP to verify the transaction status.",
      tat: "For a confirmed {category}, RBI specifies reversal by T+{deadline} calendar {dayUnit}. Compensation is ₹100/day beyond T+{deadline}.",
      compensationUnknown:
        "The transaction date/status is needed to assess any delay compensation.",
      compensationNone:
        "No delay compensation is indicated yet: the T+{deadline} deadline has not been passed.",
      compensationEstimate:
        "Estimated delay compensation: ₹{compensation}; the bank must verify the dates and reversal status before paying it.",
      complain:
        "Raise a complaint in the PSP app/bank and keep its acknowledgement. This draft has not filed a dispute.",
    },
    voluntary: {
      notify:
        "Notify your bank/PSP immediately and request wrong-beneficiary recovery.",
      noGuarantee:
        "A voluntary transfer to the wrong VPA has no automatic refund guarantee. Recovery depends on bank review and the recipient’s cooperation or applicable process.",
      keep:
        "Keep the transaction receipt and acknowledgement. Never pay a recovery fee or share a PIN/OTP.",
    },
    generic: [
      "Please share the transaction type, amount, date/status and labelled 12-digit UTR/RRN from the receipt. Do not share Aadhaar, account numbers, PINs or OTPs.",
      "If you suspect fraud, contact your bank/PSP and call 1930 immediately.",
    ],
    askForUtr:
      "Please find the labelled 12-digit UTR/RRN in your receipt; an unlabelled 12-digit number may be a sensitive ID.",
    policyRevalidation:
      "This transaction date needs review against the newer RBI liability framework.",
    escalation: OMBUDSMAN_NOTE,
    category: {
      p2m: "UPI merchant-confirmation failure",
      p2p: "UPI transfer not credited to the beneficiary",
    },
    dayUnit: { one: "day", many: "days" },
  },

  hinglish: {
    intro:
      "Samajh sakte hain, paise katna kaafi stressful hai. Aaiye, ek-ek step lete hain.",
    fraud: {
      report:
        "Abhi bank/PSP ko fraud report karein aur UPI/payment channel secure ya block karne ko kahein. Kisi ko PIN/OTP na dein.",
      cybercrime:
        "Turant 1930 par call karein aur cybercrime.gov.in par complaint dein. SMS aur screenshots sambhaal kar rakhein.",
      dispute:
        "PSP app mein UTR {utr} par dispute raise karein aur bank ko bhi batayein.",
      disputeNoUtr:
        "PSP app mein is transaction par dispute raise karein aur bank ko bhi batayein.",
      noGuarantee:
        "Refund ya zero liability abhi confirm nahi hai; bank ko facts, authorisation aur reporting window verify karna hoga.",
    },
    technical: {
      verify:
        "Bank/PSP se transaction status verify karein (UTR {utr}).",
      verifyNoUtr: "Bank/PSP se transaction status verify karein.",
      tat: "{category} confirm hone par, RBI reversal T+{deadline} calendar {dayUnit} tak specify karta hai. T+{deadline} ke baad ₹100/day compensation hai.",
      compensationUnknown:
        "Delay compensation ka anda lagane ke liye transaction ki date/status chahiye.",
      compensationNone:
        "Abhi delay compensation nahi banta: T+{deadline} ki deadline abhi guzar nahi hai.",
      compensationEstimate:
        "Estimated delay compensation: ₹{compensation}; dates aur reversal status bank verify karega, tabhi payment hogi.",
      complain:
        "PSP app/bank mein complaint karein aur acknowledgement rakhein. Ye draft dispute file nahi karta.",
    },
    voluntary: {
      notify:
        "Bank/PSP ko turant batayein aur wrong-beneficiary recovery request karein.",
      noGuarantee:
        "Galat VPA par khud bheji hui paise ka automatic refund guarantee nahi hota. Recovery bank review aur receiver ki cooperation par depend karti hai.",
      keep:
        "Transaction receipt aur acknowledgement sambhaal kar rakhein. Recovery fee kabhi mat dein aur PIN/OTP share mat karein.",
    },
    generic: [
      "Transaction type, amount, date/status aur receipt se labelled 12-digit UTR/RRN bhejein. Aadhaar, account number, PIN ya OTP share mat karein.",
      "Agar fraud ka shak ho, turant bank/PSP se sampark karein aur 1930 par call karein.",
    ],
    askForUtr:
      "Receipt mein labelled 12-digit UTR/RRN dhoondhein; bina label wala 12-digit number koi sensitive ID bhi ho sakta hai.",
    policyRevalidation:
      "Is transaction ki date ko naye RBI liability framework ke against dobara dekhna hoga.",
    escalation:
      "Pehle apne bank/PSP ko complaint karein aur uska acknowledgement rakhein. Reply se khush na ho, ya 30 din baad koi reply na mile (ya RBI/NPCI/card-network ka jo period lamba ho), to cms.rbi.org.in par eligibility check karein.",
    category: {
      p2m: "UPI merchant-confirmation failure",
      p2p: "UPI transfer beneficiary ko credit nahi hua",
    },
    dayUnit: { one: "din", many: "din" },
  },

  tanglish: {
    intro:
      "Panam debit aana romba tension-a irukkum, puriyudhu. Namma step-by-step paarkalaam.",
    fraud: {
      report:
        "Immediate ah bank/PSP-ku fraud report pannunga, UPI/payment channel secure pannunga illa block pannunga. PIN/OTP evidhu ya mattu koodathu.",
      cybercrime:
        "1930-ku immediate ah call pannunga, cybercrime.gov.in-la complaint podunga. SMS, screenshots, bank acknowledgement epdi irukkathu ennai save pannunga.",
      dispute:
        "PSP app-la UTR {utr} transaction-ku dispute raise pannunga, bank-ku sollunga.",
      disputeNoUtr:
        "PSP app-la indha transaction-ku dispute raise pannunga, bank-ku sollunga.",
      noGuarantee:
        "Refund illa zero liability ippo confirm aadha illa; bank-ku facts, authorisation, reporting window check pannanum.",
    },
    technical: {
      verify:
        "Bank/PSP-itta transaction status verify pannunga (UTR {utr}).",
      verifyNoUtr: "Bank/PSP-itta transaction status verify pannunga.",
      tat: "{category} confirm aayidum na, RBI reversal T+{deadline} calendar {dayUnit} varaikku thaaiya pidichu kekkiradhu. T+{deadline} keezhai ₹100/day compensation.",
      compensationUnknown:
        "Delay compensation evaluate pannunga transaction date/status venum.",
      compensationNone:
        "Ippo delay compensation varam illa: T+{deadline} deadline ippo vilaiyaal illa.",
      compensationEstimate:
        "Estimated delay compensation: ₹{compensation}; dates, reversal status bank verify pannanum, apparam paadungal.",
      complain:
        "PSP app/bank-la complaint pannunga, acknowledgement vechirukkunga. Indha draft dispute file pannadhu.",
    },
    voluntary: {
      notify:
        "Bank/PSP-ku immediate ah sollunga, wrong-beneficiary recovery request pannunga.",
      noGuarantee:
        "Wrong VPA-ku namma thanthu pannina panam-ku automatic refund guarantee illa. Recovery bank review, receiver cooperation ku depends aayidum.",
      keep:
        "Transaction receipt, acknowledgement save pannunga. Recovery fee kadaividu, PIN/OTP share pannadhu.",
    },
    generic: [
      "Transaction type, amount, date/status, receipt-la irundhu labelled 12-digit UTR/RRN anuppunga. Aadhaar, account number, PIN, OTP share pannadhu.",
      "Fraud ennai nanbeno, immediate ah bank/PSP-ku sollunga, 1930-ku call pannunga.",
    ],
    askForUtr:
      "Receipt-la labelled 12-digit UTR/RRN tharuvunga; label illa 12-digit number sensitive ID aam irukkalam.",
    policyRevalidation:
      "Indha transaction date-nu naye RBI liability framework-ellaam paathu mannadiyaal theriya vendum.",
    escalation:
      "Mudhaliya unga bank/PSP-kku complaint pannunga, acknowledgement vechirukkunga. Reply-la manakkathu illa, 30 naal-kitte reply varadhu illa (athu RBI/NPCI/card-network period-la inga irundha), cms.rbi.org.in-la eligibility check pannunga.",
    category: {
      p2m: "UPI merchant-confirmation failure",
      p2p: "UPI transfer beneficiary-ku credit avanavittu",
    },
    dayUnit: { one: "naal", many: "naal" },
  },

  marathi_english: {
    intro:
      "पैसे गेल्यामुळे तणाव आला असेल, समजतो. आपण एक-एक पायरी घेऊ.",
    fraud: {
      report:
        "लगेच बँक/PSP ला fraud report करा आणि UPI/payment channel secure किंवा block करा. PIN/OTP कोणालाही देऊ नका.",
      cybercrime:
        "लगेच 1930 वर call करा आणि cybercrime.gov.in वर तक्रार नोंदवा. SMS, screenshots आणि bank चा acknowledgement जतन करा.",
      dispute:
        "PSP app मध्ये UTR {utr} च्या transaction वर dispute raise करा आणि bank ला कळवा.",
      disputeNoUtr:
        "PSP app मध्ये या transaction वर dispute raise करा आणि bank ला कळवा.",
      noGuarantee:
        "Refund किंवा zero liability आता confirm नाही; bank ला facts, authorisation आणि reporting window तपासावे लागेल.",
    },
    technical: {
      verify:
        "बँक/PSP कडून transaction status verify करून घ्या (UTR {utr}).",
      verifyNoUtr: "बँक/PSP कडून transaction status verify करून घ्या.",
      tat: "{category} निश्चित झाल्यास, RBI ने reversal T+{deadline} calendar {dayUnit} पर्यंतचा कालावधी सांगितला आहे. T+{deadline} नंतर ₹100/day compensation.",
      compensationUnknown:
        "Delay compensation ठरवण्यासाठी transaction ची date/status आवश्यक आहे.",
      compensationNone:
        "अद्याप delay compensation लागू होत नाही: T+{deadline} deadline अद्याप पलीका नाही.",
      compensationEstimate:
        "Estimated delay compensation: ₹{compensation}; dates आणि reversal status bank ला verify करावे लागेल, त्यानंतरच payment होईल.",
      complain:
        "PSP app/bank मध्ये complaint करा आणि त्याचा acknowledgement जतन करा. हा draft dispute file करत नाही.",
    },
    voluntary: {
      notify:
        "लगेच bank/PSP ला कळवा आणि wrong-beneficiary recovery ची विनंती करा.",
      noGuarantee:
        "चुकूनच VPA ला पैसे पाठवल्यास आपोआप refund ची हमी नाही. Recovery bank च्या तपासणीवर आणि receiver च्या सहकार्यावर अवलंबून आहे.",
      keep:
        "Transaction receipt आणि acknowledgement जतन करा. Recovery fee कधीही देऊ नका आणि PIN/OTP शेअर करू नका.",
    },
    generic: [
      "Transaction type, amount, date/status आणि receipt मधील labelled 12-digit UTR/RRN पाठवा. Aadhaar, account number, PIN किंवा OTP शेअर करू नका.",
      "Fraud शंका वाटल्यास लगेच bank/PSP ला संपर्क साधा आणि 1930 वर call करा.",
    ],
    askForUtr:
      "Receipt मध्ये labelled 12-digit UTR/RRN शोधा; label नसलेला 12-digit number एखादा sensitive ID असू शकतो.",
    policyRevalidation:
      "या transaction च्या date चा नव्या RBI liability framework शी पुन्हा विचार करावा लागेल.",
    escalation:
      "प्रथम तुमच्या bank/PSP ला complaint करा आणि त्याचा acknowledgement जतन करा. उत्तरावर समाधान नाही झाल्यास, किंवा 30 दिवसांनी उत्तर मिळाले नाही (किंवा RBI/NPCI/card-network चा लागू कालावधी जो अधिक असेल), cms.rbi.org.in वर eligibility तपासा.",
    category: {
      p2m: "UPI merchant-confirmation failure",
      p2p: "UPI transfer beneficiary ला credit झाले नाही",
    },
    dayUnit: { one: "दिवस", many: "दिवस" },
  },

  hindi_devanagari: {
    intro:
      "पैसे कटने से परेशानी होना स्वाभाविक है। हम एक-एक कदम समझते हैं।",
    fraud: {
      report:
        "तुरंत बैंक/PSP को fraud report करें और UPI/payment channel सुरक्षित करवाएँ या block करवाएँ। किसी को PIN/OTP न दें।",
      cybercrime:
        "तुरंत 1930 पर call करें और cybercrime.gov.in पर शिकायत दर्ज करें। SMS, screenshots और bank का acknowledgement सहेज कर रखें।",
      dispute:
        "PSP app में UTR {utr} के लेनदेन पर dispute raise करें और बैंक को भी सूचित करें।",
      disputeNoUtr:
        "PSP app में इस लेनदेन पर dispute raise करें और बैंक को भी सूचित करें।",
      noGuarantee:
        "Refund या zero liability अभी पुष्ट नहीं है; bank को facts, authorisation और reporting window verify करने होंगे।",
    },
    technical: {
      verify: "बैंक/PSP से transaction status verify कराएँ (UTR {utr})।",
      verifyNoUtr: "बैंक/PSP से transaction status verify कराएँ।",
      tat: "{category} की पुष्टि होने पर, RBI reversal T+{deadline} कैलेंडर {dayUnit} तक निर्धारित करता है। T+{deadline} के बाद ₹100/day compensation।",
      compensationUnknown:
        "Delay compensation का आकलन करने के लिए transaction की date/status चाहिए।",
      compensationNone:
        "अभी delay compensation देय नहीं है: T+{deadline} की deadline अभी बीत नहीं है।",
      compensationEstimate:
        "अनुमानित delay compensation: ₹{compensation}; dates और reversal status bank verify करेगा, तभी payment होगी।",
      complain:
        "PSP app/bank में complaint करें और उसका acknowledgement रखें। यह draft dispute file नहीं करता।",
    },
    voluntary: {
      notify:
        "तुरंत bank/PSP को बताएँ और wrong-beneficiary recovery की request करें।",
      noGuarantee:
        "गलत VPA पर स्वयं भेजे गए पैसे का स्वतः refund guarantee नहीं है। Recovery bank review और recipient की सहायता पर निर्भर है।",
      keep:
        "Transaction receipt और acknowledgement सहेज कर रखें। Recovery fee कभी न दें और PIN/OTP साझा न करें।",
    },
    generic: [
      "Transaction type, amount, date/status और receipt से labelled 12-digit UTR/RRN भेजें। Aadhaar, account number, PIN या OTP साझा न करें।",
      "Fraud का शक हो तो तुरंत bank/PSP से संपर्क करें और 1930 पर call करें।",
    ],
    askForUtr:
      "Receipt में labelled 12-digit UTR/RRN ढूँढें; बिना label वाला 12-digit number कोई sensitive ID भी हो सकता है।",
    policyRevalidation:
      "इस transaction की date को नए RBI liability framework के साथ दोबारा देखना होगा।",
    escalation:
      "पहले अपने bank/PSP को शिकायत करें और उसका acknowledgement रखें। उत्तर से संतुष्ट न हों, या 30 दिन बाद कोई उत्तर न मिले (या RBI/NPCI/card-network की लागू अवधि जो अधिक हो), तो cms.rbi.org.in पर eligibility जाँचें।",
    category: {
      p2m: "UPI merchant-confirmation failure",
      p2p: "UPI transfer beneficiary को credit नहीं हुआ",
    },
    dayUnit: { one: "दिन", many: "दिन" },
  },
};

/** Fill {token} placeholders in a template. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
