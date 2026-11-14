/**
 * Varied-wording training candidates for human review.
 *
 *   node scripts/author_variations.ts > data/review/variation_queue.v1.jsonl
 *
 * The wording below is hand-written to differ from the template corpus and
 * from data/challenge (checked here). Each case's category is the author's;
 * every other label (facts, tier, actions, panic, reply) is computed by the
 * policy rules for that category, so a reviewer judges the category and the
 * wording. Nothing here is human-reviewed until scripts/prepare_review.py
 * records a decision.
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

// {amt} and {utr} are filled per case; some cases drop the UTR on purpose.
const TEXT: Record<Cat, Record<Lang, string[]>> = {
  P2M_CONFIRMATION_FAILURE: {
    english: [
      "Tried paying the chemist {amt} by UPI, my balance dropped but his counter never showed the payment.{utr}",
      "Online order checkout spun forever, then said payment not completed. Bank still took {amt}.{utr}",
      "Scanned the restaurant QR to settle the bill, {amt} gone from my account, staff say they got nothing.{utr}",
      "Recharged my phone through the app, recharge never happened but {amt} was taken.{utr}",
      "The toll plaza UPI payment errored out, yet my account shows {amt} deducted.{utr}",
      "Paid school fees {amt} on the portal, receipt never came and the school says unpaid, but my bank debited it.{utr}",
      "Movie ticket booking crashed at payment, no tickets issued, {amt} still went from my savings.{utr}",
      "Gas cylinder booking payment shows failed in the app, though {amt} is debited in my passbook.{utr}",
    ],
    hinglish: [
      "Medical store pe UPI se {amt} diye, mera balance kam ho gaya par uske paas payment aaya hi nahi.{utr}",
      "Online order ka payment atak gaya, app bol raha payment complete nahi hua, bank ne {amt} le liye.{utr}",
      "Hotel ka bill QR se bhara, {amt} kat gaye lekin counter wale bole paisa nahi aaya.{utr}",
      "Mobile recharge kiya, recharge hua hi nahi aur {amt} chale gaye.{utr}",
      "Toll pe UPI payment error aa gaya, phir bhi account se {amt} kat gaye.{utr}",
      "Coaching fees {amt} portal pe bhari, receipt nahi mili aur wo log bol rahe fees pending hai, bank se kat gaye.{utr}",
      "Ticket book karte waqt app crash ho gaya, ticket nahi mila par {amt} kat gaye.{utr}",
      "Gas booking ka payment app mein failed dikh raha, passbook mein {amt} debit hai.{utr}",
    ],
    hindi_devanagari: [
      "दवा की दुकान पर UPI से {amt} दिए, मेरा बैलेंस कम हो गया पर दुकानदार के पास भुगतान नहीं पहुँचा।{utr}",
      "ऑनलाइन ऑर्डर का भुगतान अटक गया, ऐप कह रहा भुगतान पूरा नहीं हुआ, पर बैंक ने {amt} काट लिए।{utr}",
      "होटल का बिल QR से भरा, {amt} कट गए लेकिन होटल वालों को पैसे नहीं मिले।{utr}",
      "मोबाइल रिचार्ज किया, रिचार्ज हुआ ही नहीं और {amt} कट गए।{utr}",
      "टोल पर UPI भुगतान में त्रुटि आई, फिर भी खाते से {amt} कट गए।{utr}",
      "स्कूल फीस {amt} पोर्टल पर भरी, रसीद नहीं मिली और स्कूल कह रहा फीस बाकी है, बैंक से कट गए।{utr}",
      "टिकट बुक करते समय ऐप बंद हो गया, टिकट नहीं मिला पर {amt} कट गए।{utr}",
      "गैस बुकिंग का भुगतान ऐप में असफल दिख रहा है, पर पासबुक में {amt} डेबिट है।{utr}",
    ],
  },
  P2P_BENEFICIARY_NOT_CREDITED: {
    english: [
      "Sent my sister {amt} for her exam fees, my account shows debited but she still hasn't got it.{utr}",
      "Paid my tenant's deposit refund of {amt} to his UPI, money left me but never landed with him.{utr}",
      "Transferred {amt} to a colleague for lunch money, he checked twice and nothing arrived.{utr}",
      "Gave my driver his salary {amt} over UPI, it's gone from my side and missing on his.{utr}",
      "Split the trip cost and sent {amt} to my friend, her bank shows nothing even after a day.{utr}",
      "My son's hostel needed {amt}, I sent it to his UPI, debited from me, he says not received.{utr}",
      "Returned {amt} I owed my neighbour, the transfer cut my balance but his account has no credit.{utr}",
      "Sent {amt} to my father's account for medicines; my statement shows the debit, his doesn't show any credit.{utr}",
    ],
    hinglish: [
      "Behen ko exam fees ke liye {amt} bheje, mera debit ho gaya par usko abhi tak nahi aaye.{utr}",
      "Kirayedar ko deposit wapas {amt} bheja, mere se gaya par uske account mein pahuncha hi nahi.{utr}",
      "Colleague ko {amt} transfer kiye, usne do baar check kiya, kuch nahi aaya.{utr}",
      "Driver ki salary {amt} UPI se di, mere account se gaya aur uske paas nahi aaya.{utr}",
      "Trip ka hissa {amt} dost ko bheja, ek din ho gaya uske bank mein kuch nahi dikh raha.{utr}",
      "Bete ke hostel ke liye {amt} uske UPI pe bheje, mera kat gaya, wo bol raha mila nahi.{utr}",
      "Padosi ka udhaar {amt} lautaya, mera balance kam hua par uske khate mein credit nahi aaya.{utr}",
      "Papa ke account mein dawai ke liye {amt} bheje; mere statement mein debit hai, unke mein credit nahi.{utr}",
    ],
    hindi_devanagari: [
      "बहन को परीक्षा शुल्क के लिए {amt} भेजे, मेरे खाते से कट गए पर उसे अब तक नहीं मिले।{utr}",
      "किरायेदार को जमानत राशि {amt} लौटाई, मेरे खाते से गई पर उसके खाते में नहीं पहुँची।{utr}",
      "सहकर्मी को {amt} ट्रांसफर किए, उसने दो बार देखा, कुछ नहीं आया।{utr}",
      "ड्राइवर का वेतन {amt} UPI से दिया, मेरे खाते से गया पर उसके पास नहीं पहुँचा।{utr}",
      "यात्रा का हिस्सा {amt} दोस्त को भेजा, एक दिन हो गया उसके बैंक में कुछ नहीं दिखा।{utr}",
      "बेटे के हॉस्टल के लिए {amt} उसके UPI पर भेजे, मेरे कट गए, वह कह रहा पैसे नहीं मिले।{utr}",
      "पड़ोसी का उधार {amt} लौटाया, मेरा बैलेंस कम हुआ पर उनके खाते में जमा नहीं हुआ।{utr}",
      "पिताजी के खाते में दवा के लिए {amt} भेजे; मेरे स्टेटमेंट में डेबिट है, उनके में जमा नहीं।{utr}",
    ],
  },
  COLLECT_REQUEST_SCAM: {
    english: [
      "Listed my old bike online; the 'buyer' sent a request saying accept to receive the token money, I accepted and {amt} was pulled.{utr}",
      "A person claiming to be from the electricity board sent a pay request for 'refund adjustment', approving it took {amt}.{utr}",
      "Got a UPI request labelled 'cashback credit'. I entered my PIN thinking I'd receive money; {amt} left instead.{utr}",
      "Army officer buying my furniture asked me to approve his request to get paid; my account lost {amt}.{utr}",
      "Someone from a job portal asked me to accept a 'joining bonus' request and {amt} was deducted.{utr}",
      "A shopper on the marketplace sent me a QR to 'collect' the payment for my phone; scanning it debited {amt}.{utr}",
      "They said approve the request to unlock my prize, the approval took {amt} from my account.{utr}",
      "Rental flat 'owner' sent a request, said it was the security deposit coming to me, but {amt} went out.{utr}",
    ],
    hinglish: [
      "Purani bike online daali thi, 'buyer' ne request bheji bola accept karo token aayega, accept kiya aur {amt} kat gaye.{utr}",
      "Bijli board wala bana ke kisi ne refund ke naam pe request bheji, approve karte hi {amt} gaye.{utr}",
      "'Cashback credit' naam ki UPI request aayi, PIN daala socha paise aayenge, ulta {amt} chale gaye.{utr}",
      "Furniture lene wala army wala bola payment lene ke liye request approve karo, mere {amt} kat gaye.{utr}",
      "Job portal wale ne joining bonus ki request accept karwayi aur {amt} nikal gaye.{utr}",
      "Marketplace pe phone bechne ke liye buyer ne QR bheja bola scan karo paise milenge, scan kiya to {amt} kat gaye.{utr}",
      "Bola inaam ke liye request approve karo, approve kiya aur {amt} kat gaye.{utr}",
      "Flat ke 'malik' ne request bheji bola deposit wapas aa raha, par {amt} chale gaye.{utr}",
    ],
    hindi_devanagari: [
      "पुरानी बाइक ऑनलाइन बेचने डाली, 'खरीदार' ने अनुरोध भेजा कि टोकन पाने के लिए स्वीकार करें, स्वीकार किया तो {amt} कट गए।{utr}",
      "बिजली विभाग का बताकर किसी ने रिफंड के नाम पर अनुरोध भेजा, मंज़ूर करते ही {amt} चले गए।{utr}",
      "'कैशबैक' नाम का UPI अनुरोध आया, पैसे मिलने के लिए PIN डाला, उल्टा {amt} कट गए।{utr}",
      "फर्नीचर खरीदने वाले ने कहा भुगतान लेने के लिए अनुरोध मंज़ूर करो, मेरे {amt} कट गए।{utr}",
      "नौकरी वाली साइट के व्यक्ति ने जॉइनिंग बोनस का अनुरोध स्वीकार करवाया और {amt} निकल गए।{utr}",
      "फोन बेचने पर खरीदार ने QR भेजकर कहा स्कैन करो पैसे मिलेंगे, स्कैन किया तो {amt} कट गए।{utr}",
      "इनाम पाने के लिए अनुरोध मंज़ूर करने को कहा, मंज़ूर किया और {amt} कट गए।{utr}",
      "किराये के फ्लैट के 'मालिक' ने अनुरोध भेजा कि जमा राशि लौट रही है, पर {amt} चले गए।{utr}",
    ],
  },
  REMOTE_ACCESS_SCAM: {
    english: [
      "A caller said my card would be blocked and had me install a support app that mirrors the screen; afterwards {amt} was debited.{utr}",
      "Insurance agent on the phone asked me to download QuickSupport to update my policy, then {amt} went from my account.{utr}",
      "Got a call about a pending KYC, they guided me to install an app and share the screen, and {amt} was transferred out.{utr}",
      "Someone pretending to be from the telecom company had me install a remote app for 'SIM upgrade', {amt} vanished.{utr}",
      "The 'courier' caller asked me to install an app to reschedule delivery; my UPI then paid {amt} to someone.{utr}",
      "Tech support caller fixed my 'virus' through a screen-sharing app and {amt} left my account during the call.{utr}",
      "A gas agency caller made me install a link app to update my booking, then {amt} was deducted.{utr}",
      "Pension office caller had me share my screen for verification and {amt} was withdrawn.{utr}",
    ],
    hinglish: [
      "Call aaya ki card block ho jayega, ek support app daalwaya jo screen dikhata hai, uske baad {amt} kat gaye.{utr}",
      "Insurance wale ne phone pe QuickSupport download karwaya policy update ke liye, phir {amt} chale gaye.{utr}",
      "KYC pending bol ke call aaya, app install karwa ke screen share karwayi aur {amt} nikal gaye.{utr}",
      "SIM upgrade ke naam pe remote app daalwaya, {amt} gayab ho gaye.{utr}",
      "Courier wale ne delivery ke liye app install karwaya, phir UPI se {amt} kisi ko chale gaye.{utr}",
      "Tech support wale ne screen sharing app se 'virus' theek kiya aur call ke beech {amt} kat gaye.{utr}",
      "Gas agency wale ne link wala app daalwaya booking update ke liye, phir {amt} kat gaye.{utr}",
      "Pension office wale ne verification ke liye screen share karwayi aur {amt} nikal gaye.{utr}",
    ],
    hindi_devanagari: [
      "फ़ोन आया कि कार्ड बंद हो जाएगा, स्क्रीन दिखाने वाला सपोर्ट ऐप डलवाया, उसके बाद {amt} कट गए।{utr}",
      "बीमा एजेंट ने फ़ोन पर पॉलिसी अपडेट के लिए QuickSupport डलवाया, फिर {amt} चले गए।{utr}",
      "KYC बाकी है कहकर फ़ोन आया, ऐप डलवाकर स्क्रीन शेयर करवाई और {amt} निकल गए।{utr}",
      "सिम अपग्रेड के नाम पर रिमोट ऐप डलवाया, {amt} गायब हो गए।{utr}",
      "कूरियर वाले ने डिलीवरी के लिए ऐप डलवाया, फिर UPI से {amt} किसी को चले गए।{utr}",
      "तकनीकी सहायता वाले ने स्क्रीन शेयर ऐप से 'वायरस' ठीक किया और कॉल के दौरान {amt} कट गए।{utr}",
      "गैस एजेंसी वाले ने बुकिंग अपडेट के लिए लिंक वाला ऐप डलवाया, फिर {amt} कट गए।{utr}",
      "पेंशन कार्यालय वाले ने सत्यापन के लिए स्क्रीन शेयर करवाई और {amt} निकल गए।{utr}",
    ],
  },
  UNAUTHORIZED_ACCOUNT_TAKEOVER: {
    english: [
      "Checked my app this morning and found {amt} paid to an unknown UPI ID at 3 am, I was asleep.{utr}",
      "My phone was snatched at the station and by evening {amt} had been sent out through UPI.{utr}",
      "Got an alert that my UPI was registered on a new device, then {amt} went out; it wasn't me.{utr}",
      "Somebody changed my UPI PIN without me and transferred {amt}.{utr}",
      "Three small payments adding to {amt} went to a wallet I have never heard of.{utr}",
      "My email and bank login were compromised and {amt} was moved through UPI.{utr}",
      "After my SIM suddenly lost network, {amt} was debited through UPI transfers I never made.{utr}",
      "Money keeps going out: {amt} today to an account I don't know, I haven't shared anything.{utr}",
    ],
    hinglish: [
      "Subah app dekha to raat 3 baje kisi anjaan UPI ID pe {amt} gaye the, main so raha tha.{utr}",
      "Station pe phone chheen liya aur shaam tak UPI se {amt} bhej diye gaye.{utr}",
      "Alert aaya ki naye device pe mera UPI register hua, phir {amt} chale gaye, maine nahi kiya.{utr}",
      "Kisi ne bina bataye mera UPI PIN badal diya aur {amt} transfer kar diye.{utr}",
      "Teen chhote payment milake {amt} kisi anjaan wallet mein chale gaye.{utr}",
      "Mera email aur bank login hack ho gaya aur UPI se {amt} nikal liye.{utr}",
      "SIM ka network achanak chala gaya, phir UPI se {amt} kat gaye jo maine kabhi nahi bheje.{utr}",
      "Paise nikalte ja rahe hain: aaj {amt} kisi anjaan account mein, maine kuch share nahi kiya.{utr}",
    ],
    hindi_devanagari: [
      "सुबह ऐप देखा तो रात 3 बजे किसी अनजान UPI ID पर {amt} गए थे, मैं सो रहा था।{utr}",
      "स्टेशन पर फ़ोन छीन लिया गया और शाम तक UPI से {amt} भेज दिए गए।{utr}",
      "अलर्ट आया कि नए डिवाइस पर मेरा UPI पंजीकृत हुआ, फिर {amt} चले गए, यह मैंने नहीं किया।{utr}",
      "किसी ने मुझे बताए बिना मेरा UPI PIN बदल दिया और {amt} ट्रांसफर कर दिए।{utr}",
      "तीन छोटे भुगतान मिलाकर {amt} किसी अनजान वॉलेट में चले गए।{utr}",
      "मेरा ईमेल और बैंक लॉगिन हैक हो गया और UPI से {amt} निकाल लिए गए।{utr}",
      "सिम का नेटवर्क अचानक चला गया, फिर UPI से {amt} कट गए जो मैंने कभी नहीं भेजे।{utr}",
      "पैसे निकलते जा रहे हैं: आज {amt} किसी अनजान खाते में, मैंने कुछ साझा नहीं किया।{utr}",
    ],
  },
  VOLUNTARY_WRONG_VPA_TRANSFER: {
    english: [
      "I picked the wrong name from my contacts and paid {amt} to a stranger myself.{utr}",
      "Copied the UPI ID wrongly from the chat, so my {amt} went to some other person; my error.{utr}",
      "I sent {amt} to an old number of my cousin that now belongs to someone else.{utr}",
      "Autofill chose a similar UPI ID and I didn't notice before paying {amt}.{utr}",
      "My mistake: I typed 'sharma12' instead of 'sharma21' and {amt} went to the wrong person.{utr}",
      "I scanned the wrong person's QR from a group photo and paid {amt}.{utr}",
      "Paid {amt} to the earlier landlord out of habit instead of the new one.{utr}",
      "I mistakenly sent {amt} twice; the second time to a wrong UPI handle.{utr}",
    ],
    hinglish: [
      "Contacts se galat naam chun liya aur khud hi {amt} anjaan ko bhej diye.{utr}",
      "Chat se UPI ID galat copy kar li, mere {amt} kisi aur ko chale gaye, galti meri hai.{utr}",
      "Cousin ke purane number pe {amt} bheje jo ab kisi aur ka hai.{utr}",
      "Autofill ne milti julti UPI ID le li aur maine dekhe bina {amt} bhej diye.{utr}",
      "Meri galti: 'sharma12' ki jagah 'sharma21' likh diya aur {amt} galat bande ko gaye.{utr}",
      "Group photo se galat bande ka QR scan karke {amt} de diye.{utr}",
      "Aadat se purane makaan malik ko {amt} bhej diye, naye ko nahi.{utr}",
      "Galti se {amt} do baar bheje, doosri baar galat UPI handle pe.{utr}",
    ],
    hindi_devanagari: [
      "संपर्कों में से गलत नाम चुन लिया और खुद ही {amt} अनजान व्यक्ति को भेज दिए।{utr}",
      "चैट से UPI ID गलत कॉपी कर ली, मेरे {amt} किसी और को चले गए, गलती मेरी है।{utr}",
      "चचेरे भाई के पुराने नंबर पर {amt} भेजे जो अब किसी और का है।{utr}",
      "ऑटोफिल ने मिलती-जुलती UPI ID चुन ली और मैंने देखे बिना {amt} भेज दिए।{utr}",
      "मेरी गलती: 'sharma12' की जगह 'sharma21' लिख दिया और {amt} गलत व्यक्ति को गए।{utr}",
      "ग्रुप फोटो से गलत व्यक्ति का QR स्कैन करके {amt} दे दिए।{utr}",
      "आदत से पुराने मकान मालिक को {amt} भेज दिए, नए को नहीं।{utr}",
      "गलती से {amt} दो बार भेजे, दूसरी बार गलत UPI हैंडल पर।{utr}",
    ],
  },
  NEEDS_INFORMATION: {
    english: [
      "There's a UPI line in my passbook I can't place, could you help me figure out what it is?",
      "My UPI app shows a transaction status I don't understand. What does 'deemed' mean?",
      "I think something went wrong with a payment last week but I'm not sure which one.",
      "Can you tell me how to check whether my UPI payment went through?",
      "A UPI entry of {amt} appears twice in my history, not sure if I was charged twice.",
      "My father says a payment failed but he can't remember the amount or to whom.",
      "I'm getting UPI SMS alerts I can't match to anything, please guide me.",
      "How long does a UPI transaction usually take to show up?",
    ],
    hinglish: [
      "Passbook mein ek UPI entry hai samajh nahi aa rahi kiski hai, help karo.",
      "UPI app mein status 'deemed' dikha raha, iska matlab kya hai?",
      "Pichhle hafte koi payment gadbad hui lagti hai par yaad nahi kaunsi.",
      "Kaise check karun ki mera UPI payment hua ya nahi?",
      "History mein {amt} ki UPI entry do baar dikh rahi, pata nahi do baar kata ya nahi.",
      "Papa bol rahe ek payment fail hua par amount aur kisko bheja yaad nahi.",
      "Kuch UPI SMS aa rahe hain jo kisi se match nahi ho rahe, guide karo.",
      "UPI transaction dikhne mein aam taur pe kitna time lagta hai?",
    ],
    hindi_devanagari: [
      "पासबुक में एक UPI प्रविष्टि है जो समझ नहीं आ रही, कृपया बताएँ यह क्या है।",
      "UPI ऐप में स्थिति 'deemed' दिख रही है, इसका क्या मतलब है?",
      "पिछले सप्ताह कोई भुगतान गड़बड़ हुआ लगता है पर याद नहीं कौन सा।",
      "कैसे जाँचूँ कि मेरा UPI भुगतान हुआ या नहीं?",
      "इतिहास में {amt} की UPI प्रविष्टि दो बार दिख रही है, पता नहीं दो बार कटा या नहीं।",
      "पिताजी कह रहे हैं एक भुगतान असफल हुआ पर राशि और किसे भेजा याद नहीं।",
      "कुछ UPI SMS आ रहे हैं जो किसी से मेल नहीं खाते, मार्गदर्शन करें।",
      "UPI लेनदेन दिखने में आमतौर पर कितना समय लगता है?",
    ],
  },
};

const FRAUD: Cat[] = ["COLLECT_REQUEST_SCAM", "REMOTE_ACCESS_SCAM", "UNAUTHORIZED_ACCOUNT_TAKEOVER"];
const RESPONSIBILITY = ["unknown", "third_party", "bank", "customer"] as const;
const DELAYS = [null, 0, 2, 5, 9] as const;
const ELAPSED = [null, 0, 3, 7, 12] as const;
const AMOUNT_STYLE = [(n: number) => `₹${n.toLocaleString("en-IN")}`, (n: number) => `Rs ${n}`, (n: number) => `Rs.${n}`, (n: number) => `INR ${n}`];
const UTR_STYLE = [(u: string) => ` UTR ${u}`, (u: string) => ` UPI Ref No ${u}`, (u: string) => ` Statement shows UPI/${u}/`, () => ""];
const REJECTED: Record<Lang, string> = {
  english: "Your refund is 100% guaranteed. The dispute is already filed and a full reversal is approved.",
  hinglish: "Aapka refund 100% guaranteed hai. Dispute already filed hai aur full reversal approved hai.",
  hindi_devanagari: "आपका रिफंड 100% गारंटी के साथ मंजूर है। refund approved है और dispute already filed है।",
};

// Wording must not overlap the challenge set (evaluation stays held out).
const trigrams = (s: string) => {
  const t = s.toLowerCase().replace(/\s+/g, " ");
  return new Set(Array.from({ length: Math.max(0, t.length - 2) }, (_, i) => t.slice(i, i + 3)));
};
const challenge = fs.readFileSync("data/challenge/category-challenge-v1.jsonl", "utf8").trim().split("\n").map((l) => trigrams(JSON.parse(l).message));
const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let serial = 0;
const out: unknown[] = [];
for (const [category, byLang] of Object.entries(TEXT) as [Cat, Record<Lang, string[]>][]) {
  for (const [language, texts] of Object.entries(byLang) as [Lang, string[]][]) {
    texts.forEach((template, k) => {
      serial++;
      const amount = 300 + ((serial * 137) % 49) * 250;
      const utr = `81000${String(900000 + serial).padStart(7, "0")}`;
      const hasUtr = category !== "NEEDS_INFORMATION" && k % 4 !== 3;
      const message = template
        .replace("{amt}", AMOUNT_STYLE[serial % 4](amount))
        .replace("{utr}", hasUtr ? UTR_STYLE[serial % 3](utr) : "");
      const worst = Math.max(...challenge.map((c) => jaccard(trigrams(message), c)));
      if (worst > 0.6) throw new Error(`variation too close to the challenge set: ${message}`);
      const input: TriageInput = { message, language };
      if (FRAUD.includes(category)) {
        input.responsibility = RESPONSIBILITY[k % 4];
        const delay = DELAYS[(k + serial) % 5];
        if (delay !== null) input.reporting_delay_working_days = delay;
      }
      if (category === "P2M_CONFIRMATION_FAILURE" || category === "P2P_BENEFICIARY_NOT_CREDITED") {
        const elapsed = ELAPSED[(k + serial) % 5];
        if (elapsed !== null) input.elapsed_calendar_days = elapsed;
      }
      const result = triage(input, { category });
      const id = `var-${category.toLowerCase().replace(/_/g, "-")}-${language}-${k}`;
      const provenance = {
        sample_id: id, scenario_group: `variation:${category.toLowerCase()}:${k}`, split: k === 7 ? "validation" : "train",
        origin: "authored_variation", human_reviewed: false, label_status: "authored_variation_unreviewed",
        source_provenance: null, synthetic_status: "hand_written_variation", generator_version: "author_variations.v1",
        label_basis: "author category; facts, tier, actions, panic and reply from policy rules for that category",
        policy_version: result.audit.policy_version, sanitized_sha256: sha(result.privacy.sanitized),
      };
      out.push({
        review_id: id, scenario_group: provenance.scenario_group, split: provenance.split, origin: "authored_variation",
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
