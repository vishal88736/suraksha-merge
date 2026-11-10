import type { LocalizedText } from "./i18n/locales.ts";

export const POLICY_VERSION = "IN-UPI-2026-11-09";

export type PolicySource = {
  id: string;
  title: LocalizedText;
  date: string;
  url: string;
  note: LocalizedText;
};

/**
 * The primary sources behind the internal policy. The citation, the date and
 * the link are identifiers; the explanatory note is localised prose.
 */
export const SOURCES: PolicySource[] = [
  {
    id: "rbi-liability-2017",
    title: { en: "RBI · Customer liability", hi: "RBI · ग्राहक दायित्व" },
    date: "2017-07-06",
    url: "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11040&Mode=0",
    note: {
      en: "Bank negligence, third-party breach and customer negligence have different rules. Working days exclude the date of receiving the bank communication.",
      hi: "बैंक की लापरवाही, तृतीय पक्ष की गड़बड़ी और ग्राहक की लापरवाही के नियम अलग-अलग हैं। कार्य दिवसों में बैंक के पत्र की प्राप्ति की तारीख़ शामिल नहीं है।",
    },
  },
  {
    id: "rbi-tat-2019",
    title: { en: "RBI · Failed transaction TAT", hi: "RBI · विफल लेनदेन TAT" },
    date: "2019-09-20",
    url: "https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=11693&Mode=0&fn=9",
    note: {
      en: "UPI transfer: T+1. Merchant confirmation failure: T+5. T refers to calendar date; compensation is ₹100 per day beyond the applicable deadline.",
      hi: "UPI ट्रांसफ़र: T+1। व्यापारी पुष्टि की विफलता: T+5। T कैलेंडर तारीख़ दर्शाता है; लागू समय-सीमा के बाद मुआवज़ा ₹100 प्रति दिन है।",
    },
  },
  {
    id: "npci-redressal",
    title: { en: "NPCI · Dispute redressal", hi: "NPCI · विवाद निवारण" },
    date: "2026-11-09",
    url: "https://www.npci.org.in/what-we-do/upi/dispute-redressal-mechanism",
    note: {
      en: "Raise a complaint in the PSP app and with the bank. Fraudulent, unidentified and unauthorised transactions should be raised with the bank. Internal demo categories are not NPCI reason codes.",
      hi: "PSP ऐप और बैंक में शिकायत करें। धोखाधड़ी, अपहचानी गई और अनधिकृत लेनदेन बैंक में दर्ज कराए जाएँ। आंतरिक डेमो श्रेणियाँ NPCI कारण कोड नहीं हैं।",
    },
  },
  {
    id: "i4c-report",
    title: { en: "I4C · Report financial cybercrime", hi: "I4C · वित्तीय साइबर अपराध की सूचना" },
    date: "2026-11-09",
    url: "https://cybercrime.gov.in/",
    note: {
      en: "Report financial cyber fraud immediately via 1930 and cybercrime.gov.in. Recovery is not guaranteed.",
      hi: "वित्तीय साइबर धोखाधड़ी की तुरंत सूचना 1930 और cybercrime.gov.in पर दें। वसूली की गारंटी नहीं है।",
    },
  },
  {
    id: "rbi-ios-2026",
    title: { en: "RBI · Ombudsman scheme 2026", hi: "RBI · ओम्बुड्समैन योजना 2026" },
    date: "2026-07-01",
    url: "https://m.rbi.org.in/commonperson/English/Scripts/FAQs.aspx?Id=3407",
    note: {
      en: "Approach the regulated entity first. Escalate if dissatisfied with the reply, or if no reply after 30 days or the applicable RBI/NPCI/card-network period, whichever is higher.",
      hi: "पहले नियामित संस्था से संपर्क करें। उत्तर से संतुष्ट न हों, या 30 दिन या लागू RBI/NPCI/कार्ड-नेटवर्क अवधि, जो भी अधिक हो, के बाद कोई उत्तर न मिले, तो आगे बढ़ें।",
    },
  },
  {
    id: "rbi-amendment-2027",
    title: {
      en: "RBI · Upcoming liability amendment",
      hi: "RBI · आगामी दायित्व संशोधन",
    },
    date: "2026-06-24",
    url: "https://www.rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx?Id=13543",
    note: {
      en: "Commercial-bank amendment applies to transactions on or after 1 January 2027; new cases from that date require policy revalidation.",
      hi: "वाणिज्यिक बैंक संशोधन 1 जनवरी 2027 या उसके बाद के लेनदेन पर लागू है; उस तारीख़ से नए मामलों की नीति पुनः जाँच आवश्यक है।",
    },
  },
];

export const OMBUDSMAN_NOTE =
  "First complain to your bank/PSP and keep its acknowledgement. If dissatisfied with the reply, or if no reply after 30 days or the applicable RBI/NPCI/card-network period (whichever is higher), check eligibility at cms.rbi.org.in.";
