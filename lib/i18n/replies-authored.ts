/**
 * Hand-written customer reply bundles (English and the romanized/Hindi
 * registers). Placeholders: {utr}, {deadline}, {dayUnit}, {category},
 * {compensation}. Kept apart from replies.ts so the translation pipeline can
 * read the English source without importing generated bundles.
 */
import { OMBUDSMAN_NOTE } from "../policy.ts";

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
  /** generic[0] for a message that already states the amount. */
  genericAmountKnown: string;
  askForUtr: string;
  policyRevalidation: string;
  escalation: string;
  category: { p2m: string; p2p: string };
  dayUnit: { one: string; many: string };
};

/** Languages whose templates were written by hand. */
export type AuthoredReplyLanguage =
  | "english"
  | "hinglish"
  | "tanglish"
  | "marathi_english"
  | "hindi_devanagari";

/**
 * Hand-written bundles. The other scheduled languages are machine-translated
 * from the English bundle with IndicTrans2, with every placeholder and rail
 * term preserved and every negation back-translation checked
 * (scripts/translate_i18n.py); they still need native-speaker review.
 */
export const AUTHORED_TEMPLATES: Record<AuthoredReplyLanguage, ReplyTemplates> = {
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
      "Please share the transaction type (to a person or a merchant), the amount and the date/status. Do not share Aadhaar, account numbers, PINs or OTPs.",
      "If you suspect fraud, contact your bank/PSP and call 1930 immediately.",
    ],
    genericAmountKnown:
      "Please share the transaction type (to a person or a merchant) and the date/status. Do not share Aadhaar, account numbers, PINs or OTPs.",
    askForUtr:
      "Please find the labelled 12-digit UTR/RRN: it is in the debit SMS, in your UPI app's transaction history (failed payments are listed too), or in the UPI/… line of your bank statement. An unlabelled 12-digit number may be a sensitive ID. If you cannot find it, share the date, time, amount and the receiving UPI ID instead.",
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
        "Delay compensation ka andaza lagane ke liye transaction ki date/status chahiye.",
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
        "Galat VPA par khud bheje hue paise ka automatic refund guarantee nahi hota. Recovery bank review aur receiver ki cooperation par depend karti hai.",
      keep:
        "Transaction receipt aur acknowledgement sambhaal kar rakhein. Recovery fee kabhi mat dein aur PIN/OTP share mat karein.",
    },
    generic: [
      "Transaction type (kisi person ko ya merchant ko), amount aur date/status bhejein. Aadhaar, account number, PIN ya OTP share mat karein.",
      "Agar fraud ka shak ho, turant bank/PSP se sampark karein aur 1930 par call karein.",
    ],
    genericAmountKnown:
      "Transaction type (kisi person ko ya merchant ko) aur date/status bhejein. Aadhaar, account number, PIN ya OTP share mat karein.",
    askForUtr:
      "Labelled 12-digit UTR/RRN dhoondhein: yeh debit SMS mein, UPI app ki transaction history mein (failed payments bhi wahan dikhte hain), ya bank statement ki UPI/… wali line mein hota hai. Bina label wala 12-digit number koi sensitive ID bhi ho sakta hai. Na mile to date, time, amount aur paane wale ki UPI ID batayein.",
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
      "Transaction type (person-ku-aa illa merchant-ku-aa), amount, date/status anuppunga. Aadhaar, account number, PIN, OTP share pannadhu.",
      "Fraud ennai nanbeno, immediate ah bank/PSP-ku sollunga, 1930-ku call pannunga.",
    ],
    genericAmountKnown:
      "Transaction type (person-ku-aa illa merchant-ku-aa), date/status anuppunga. Aadhaar, account number, PIN, OTP share pannadhu.",
    askForUtr:
      "Labelled 12-digit UTR/RRN-a debit SMS-la, UPI app transaction history-la (failed payments-um anga irukkum), illa bank statement-la UPI/… line-la paarunga. Label illadha 12-digit number sensitive ID-aa irukkalam. Kedaikkalana, date, time, amount, receiver UPI ID sollunga.",
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
      "Paise gelyamule tension aala asel, samajta. Aapan ek-ek step ghenyaat yeu.",
    fraud: {
      report:
        "Lagech bank/PSP la fraud report kara ani UPI/payment channel secure kiva block karayla sanga. PIN/OTP konalahi deu naka.",
      cybercrime:
        "Lagech 1930 var call kara ani cybercrime.gov.in var takrar nondva. SMS, screenshots ani bank cha acknowledgement japun theva.",
      dispute:
        "PSP app madhye UTR {utr} chya transaction var dispute raise kara ani bank la kalva.",
      disputeNoUtr:
        "PSP app madhye ya transaction var dispute raise kara ani bank la kalva.",
      noGuarantee:
        "Refund kiva zero liability aata confirm nahi; bank la facts, authorisation ani reporting window tapasave lagel.",
    },
    technical: {
      verify:
        "Bank/PSP kadun transaction status verify karun ghya (UTR {utr}).",
      verifyNoUtr: "Bank/PSP kadun transaction status verify karun ghya.",
      tat: "{category} confirm zalyas, RBI ne reversal sathi T+{deadline} calendar {dayUnit} paryantcha kalavadhi sangitla aahe. T+{deadline} nantar ₹100/day compensation.",
      compensationUnknown:
        "Delay compensation tharavnyasathi transaction chi date/status lagel.",
      compensationNone:
        "Ajun delay compensation lagu hot nahi: T+{deadline} chi deadline ajun ulatleli nahi.",
      compensationEstimate:
        "Estimated delay compensation: ₹{compensation}; dates ani reversal status bank verify karel, tyanantarch payment hoil.",
      complain:
        "PSP app/bank madhye complaint kara ani tyacha acknowledgement japun theva. Ha draft dispute file karat nahi.",
    },
    voluntary: {
      notify:
        "Lagech bank/PSP la kalva ani wrong-beneficiary recovery chi request kara.",
      noGuarantee:
        "Chukichya VPA la swatah pathavlelya paishancha automatic refund guarantee nahi. Recovery bank review ani receiver chya sahakaryavar avalambun aahe.",
      keep:
        "Transaction receipt ani acknowledgement japun theva. Recovery fee kadhihi deu naka ani PIN/OTP share karu naka.",
    },
    generic: [
      "Transaction type (vyakti la ki merchant la), amount ani date/status pathva. Aadhaar, account number, PIN kiva OTP share karu naka.",
      "Fraud chi shanka asel tar lagech bank/PSP shi samparka kara ani 1930 var call kara.",
    ],
    genericAmountKnown:
      "Transaction type (vyakti la ki merchant la) ani date/status pathva. Aadhaar, account number, PIN kiva OTP share karu naka.",
    askForUtr:
      "Labelled 12-digit UTR/RRN debit SMS madhye, UPI app chya transaction history madhye (failed payments pan tithe distat), kiva bank statement madhil UPI/… line madhye shodha. Label naslela 12-digit number ekhada sensitive ID asu shakto. Sapadla nahi tar date, time, amount ani ghenaryacha UPI ID sanga.",
    policyRevalidation:
      "Ya transaction chi date navya RBI liability framework pramane punha tapasavi lagel.",
    escalation:
      "Aadhi tumchya bank/PSP la complaint kara ani tyacha acknowledgement japun theva. Uttarane samadhan nahi zale, kiva 30 divsat uttar nahi aale (kiva RBI/NPCI/card-network cha lagu kalavadhi jo jast asel), tar cms.rbi.org.in var eligibility tapasa.",
    category: {
      p2m: "UPI merchant-confirmation failure",
      p2p: "UPI transfer beneficiary la credit zala nahi",
    },
    dayUnit: { one: "divas", many: "divas" },
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
      "Transaction type (किसी व्यक्ति को या merchant को), amount और date/status भेजें। Aadhaar, account number, PIN या OTP साझा न करें।",
      "Fraud का शक हो तो तुरंत bank/PSP से संपर्क करें और 1930 पर call करें।",
    ],
    genericAmountKnown:
      "Transaction type (किसी व्यक्ति को या merchant को) और date/status भेजें। Aadhaar, account number, PIN या OTP साझा न करें।",
    askForUtr:
      "Labelled 12-digit UTR/RRN ढूँढें: यह debit SMS में, UPI app की transaction history में (failed payments भी वहाँ दिखते हैं), या bank statement की UPI/… वाली line में होता है। बिना label वाला 12-digit number कोई sensitive ID भी हो सकता है। न मिले तो तारीख, समय, राशि और पाने वाले की UPI ID बताएँ।",
    policyRevalidation:
      "इस transaction की date को नए RBI liability framework के साथ दोबारा देखना होगा।",
    escalation:
      "पहले अपने bank/PSP को शिकायत करें और उसका acknowledgement रखें। उत्तर से संतुष्ट न हों, या 30 दिन बाद कोई उत्तर न मिले (या RBI/NPCI/card-network की लागू अवधि जो अधिक हो), तो cms.rbi.org.in पर eligibility जाँचें।",
    category: {
      p2m: "UPI merchant-confirmation failure",
      p2p: "UPI transfer के beneficiary को credit न होने",
    },
    dayUnit: { one: "दिन", many: "दिन" },
  },
};

