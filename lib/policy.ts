export const POLICY_VERSION = "IN-UPI-2026-11-09";
export const SOURCES = [
  {
    id: "rbi-liability-2017",
    title: "RBI · Customer liability",
    date: "2017-07-06",
    url: "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11040&Mode=0",
    note: "Bank negligence, third-party breach and customer negligence have different rules. Working days exclude the date of receiving the bank communication.",
  },
  {
    id: "rbi-tat-2019",
    title: "RBI · Failed transaction TAT",
    date: "2019-09-20",
    url: "https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=11693&Mode=0&fn=9",
    note: "UPI transfer: T+1. Merchant confirmation failure: T+5. T refers to calendar date; compensation is ₹100 per day beyond the applicable deadline.",
  },
  {
    id: "npci-redressal",
    title: "NPCI · Dispute redressal",
    date: "2026-11-09",
    url: "https://www.npci.org.in/what-we-do/upi/dispute-redressal-mechanism",
    note: "Raise a complaint in the PSP app and with the bank. Fraudulent, unidentified and unauthorised transactions should be raised with the bank. Internal demo categories are not NPCI reason codes.",
  },
  {
    id: "i4c-report",
    title: "I4C · Report financial cybercrime",
    date: "2026-11-09",
    url: "https://cybercrime.gov.in/",
    note: "Report financial cyber fraud immediately via 1930 and cybercrime.gov.in. Recovery is not guaranteed.",
  },
  {
    id: "rbi-ios-2026",
    title: "RBI · Ombudsman scheme 2026",
    date: "2026-07-01",
    url: "https://m.rbi.org.in/commonperson/English/Scripts/FAQs.aspx?Id=3407",
    note: "Approach the regulated entity first. Escalate if dissatisfied with the reply, or if no reply after 30 days or the applicable RBI/NPCI/card-network period, whichever is higher.",
  },
  {
    id: "rbi-amendment-2027",
    title: "RBI · Upcoming liability amendment",
    date: "2026-06-24",
    url: "https://www.rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx?Id=13543",
    note: "Commercial-bank amendment applies to transactions on or after 1 January 2027; new cases from that date require policy revalidation.",
  },
] as const;
export const OMBUDSMAN_NOTE =
  "First complain to your bank/PSP and keep its acknowledgement. If dissatisfied with the reply, or if no reply after 30 days or the applicable RBI/NPCI/card-network period (whichever is higher), check eligibility at cms.rbi.org.in.";
