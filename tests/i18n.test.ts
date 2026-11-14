import test from "node:test";
import assert from "node:assert/strict";
import { triage } from "../lib/engine.ts";
import { SCENARIOS } from "../lib/content/scenarios.ts";
import { catalogs, loadLocale, translate } from "../lib/i18n/catalog.ts";
import { REPLY_TEMPLATES, hasReplyTemplates } from "../lib/i18n/replies.ts";
import {
  REPLY_LANGUAGES,
  SCHEDULED_LANGUAGES,
  UI_LOCALES,
  pick,
} from "../lib/i18n/locales.ts";
import { detectLanguage } from "../lib/rules/language.ts";

test("every interface locale covers every message key", async () => {
  for (const locale of UI_LOCALES) {
    await loadLocale(locale.code);
    const catalog = catalogs[locale.code]!;
    for (const key of Object.keys(catalogs.en!) as (keyof typeof catalogs.en)[])
      assert.equal(typeof catalog[key], "string", `${locale.code}.${key}`);
    // No translation may be an empty string.
    for (const [key, value] of Object.entries(catalog))
      assert.ok(value.trim().length > 0, `${locale.code}.${key}`);
  }
});

test("every available reply bundle is complete", () => {
  for (const language of REPLY_LANGUAGES.filter((l) => hasReplyTemplates(l.code))) {
    const bundle = REPLY_TEMPLATES[language.code]!;
    assert.ok(bundle, language.code);
    assert.ok(bundle.intro.length > 0);
    assert.ok(bundle.fraud.report.length > 0);
    assert.ok(bundle.fraud.cybercrime.includes("1930"), language.code);
    assert.ok(bundle.fraud.cybercrime.includes("cybercrime.gov.in"), language.code);
    assert.ok(bundle.fraud.noGuarantee.length > 0);
    assert.ok(bundle.technical.tat.length > 0);
    assert.ok(bundle.technical.compensationUnknown.length > 0);
    assert.ok(bundle.technical.compensationNone.length > 0);
    assert.ok(bundle.technical.compensationEstimate.length > 0);
    assert.ok(bundle.voluntary.noGuarantee.length > 0);
    assert.ok(bundle.generic.length >= 2);
    assert.ok(bundle.askForUtr.length > 0);
    assert.ok(bundle.policyRevalidation.length > 0);
    assert.ok(bundle.escalation.length > 0);
  }
});

test("no template bundle leaves a placeholder unfilled", () => {
  const placeholders = /\{(\w+)\}/g;
  for (const bundle of Object.values(REPLY_TEMPLATES).filter((b) => b !== undefined)) {
    const texts = [
      bundle.intro,
      ...bundle.fraud.dispute.split("\n"),
      bundle.technical.tat,
      bundle.technical.verify,
      ...bundle.generic,
    ];
    for (const text of texts) {
      const found = [...text.matchAll(placeholders)].map((match) => match[1]);
      for (const name of found)
        assert.ok(
          ["utr", "deadline", "dayUnit", "category", "compensation"].includes(
            name,
          ),
          `unknown placeholder {${name}}`,
        );
    }
  }
});

test("the reply is written in the detected language only", () => {
  const hindi = triage({
    message:
      "मेरे UPI transfer में ₹1500 कट गए, beneficiary not credited. UTR 812345678901. कृपया मदद करें।",
  });
  assert.equal(hindi.payload.detected_language, "hindi_devanagari");
  assert.match(hindi.reply.text, /[ऀ-ॿ]/);
  assert.ok(!/[a-z]{6,}/.test(hindi.reply.introduction), hindi.reply.introduction);

  const hinglish = triage({
    message:
      "Bhaiya please help!! OLX pe sofa bech raha tha. Buyer ne QR bheja, scan ke baad mere SBI se ₹24,500 kat gaye!! UPI Ref No 431289014421",
  });
  assert.equal(hinglish.payload.detected_language, "hinglish");
  assert.match(hinglish.reply.introduction, /Samajh sakte hain/);
});

test("an explicit language overrides detection", () => {
  const result = triage({
    message: "UPI transfer Rs.1500 debited beneficiary not credited UTR 431289014421",
    language: "hindi_devanagari",
  });
  assert.equal(result.payload.detected_language, "hindi_devanagari");
  assert.match(result.reply.text, /[ऀ-ॿ]/);
});

test("detection recognises each supported language", () => {
  assert.equal(detectLanguage("Anna, Swiggy payment debitaachu illa"), "tanglish");
  assert.equal(detectLanguage("Majhe Rs.18000 gele, kay karu?"), "marathi_english");
  assert.equal(detectLanguage("Bhai paise wapas dilao jaldi"), "hinglish");
  assert.equal(detectLanguage("मुझे मदद करें, पैसे कट गए"), "hindi_devanagari");
  assert.equal(detectLanguage("Please help, my card was debited twice"), "english");
});

test("every scenario answers in its own language", () => {
  for (const scenario of SCENARIOS) {
    const result = triage(scenario.input);
    assert.equal(
      result.payload.detected_language,
      scenario.language,
      scenario.id,
    );
  }
});

test("a localised reply still passes the policy gates", () => {
  for (const scenario of SCENARIOS) {
    const result = triage(scenario.input);
    assert.equal(result.audit.no_unauthorized_promises, true, scenario.id);
    assert.equal(result.audit.fraud_rails_present, true, scenario.id);
  }
});

test("placeholders are interpolated and unknown ones are left alone", () => {
  assert.equal(
    translate("en", "provenance.anchors", { count: 3 }),
    "3 ANCHORS",
  );
  assert.equal(
    translate("hi", "provenance.anchors", { count: 3 }),
    "3 आँकर",
  );
  assert.equal(translate("en", "desk.title"), "A clearer next step.");
});

test("all 22 scheduled languages are registered; the hand-written ones are always available", () => {
  assert.equal(SCHEDULED_LANGUAGES.length, 22);
  for (const language of SCHEDULED_LANGUAGES)
    assert.ok(REPLY_LANGUAGES.some((l) => l.code === language.reply), language.reply);
  for (const code of ["english", "hinglish", "tanglish", "marathi_english", "hindi_devanagari"] as const)
    assert.ok(hasReplyTemplates(code), code);
  assert.deepEqual(UI_LOCALES.slice(0, 2).map((l) => l.code).sort(), ["en", "hi"].sort());
});

test("a language without checked templates gets an English draft and a warning", () => {
  const missing = REPLY_LANGUAGES.find((l) => !hasReplyTemplates(l.code));
  if (!missing) return; // every language has been generated
  const result = triage({ message: "UPI ₹500 debited, beneficiary not credited. UTR 612345678901", language: missing.code });
  assert.equal(result.payload.detected_language, missing.code);
  assert.match(result.reply.introduction, /I understand/);
  assert.ok(result.warnings.some((w) => w.includes("draft is in English")), result.warnings.join("|"));
  assert.equal(result.audit.no_unauthorized_promises, true);
});

test("translated interface strings keep every {placeholder} of the English source", async () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const locale of UI_LOCALES) {
    await loadLocale(locale.code);
    for (const [key, english] of Object.entries(catalogs.en!))
      assert.deepEqual(
        placeholders(catalogs[locale.code]![key as keyof typeof catalogs.en]),
        placeholders(english),
        `${locale.code}.${key}`,
      );
  }
});

test("content prose is translated once a locale is loaded", async () => {
  if (!UI_LOCALES.some((l) => l.code === "bn")) return; // not generated yet
  await loadLocale("bn");
  const scenario = SCENARIOS[0];
  assert.notEqual(pick(scenario.title, "bn"), scenario.title.en);
});

test("detection covers every script and same-script language", () => {
  const cases: [string, string][] = [
    ["আমার UPI থেকে ₹500 কেটে গেছে", "bengali"],
    ["মোৰ UPI ৰ পৰা টকা কাটি লৈছে", "assamese"],
    ["મારા UPI માંથી ₹500 કપાયા", "gujarati"],
    ["ਮੇਰੇ UPI ਤੋਂ ₹500 ਕੱਟੇ ਗਏ", "punjabi"],
    ["ನನ್ನ UPI ಇಂದ ₹500 ಕಡಿತವಾಗಿದೆ", "kannada"],
    ["എന്റെ UPI യിൽ നിന്ന് ₹500 പോയി", "malayalam"],
    ["ମୋ UPI ରୁ ₹500 କଟିଗଲା", "odia"],
    ["என் UPI இலிருந்து ₹500 கழிக்கப்பட்டது", "tamil"],
    ["నా UPI నుండి ₹500 కట్ అయ్యింది", "telugu"],
    ["ᱤᱧᱟᱜ UPI ᱠᱷᱚᱱ ₹500 ᱠᱟᱴᱟᱣ ᱮᱱᱟ", "santali"],
    ["ꯑꯩꯒꯤ UPI ꯗꯒꯤ ₹500 ꯀꯥꯏꯔꯦ", "manipuri"],
    ["میرے UPI سے ₹500 کٹ گئے", "urdu"],
    ["منهنجي UPI مان ₹500 ڪٽجي ويا", "sindhi"],
    ["میٲنۍ UPI پیٹھ ₹500 کٔٹۍ", "kashmiri"],
    ["माझे UPI पेमेंट ₹500 कट झाले, मला मदत पाहिजे", "marathi"],
    ["मेरो UPI बाट पैसा काटियो, मलाई सहयोग गर्नुहोस्", "nepali"],
    ["म्हजे पयशे कापले, म्हाका मदत करात", "konkani"],
    ["हमर पैसा कटि गेल अछि", "maithili"],
    ["आंनि रां जाबाय, नङा", "bodo"],
    ["मिगी मदद चाहिदी, पैसे कट्टी होई गेआ", "dogri"],
    ["मम धनम् अभवत्, साहाय्यं कुर्वन्तु", "sanskrit"],
    ["मुझे मदद करें, पैसे कट गए", "hindi_devanagari"],
    ["amar taka kete geche kintu pelam na", "bengali"],
    ["naa dabbulu cut ayyindi kani raaledu", "telugu"],
  ];
  for (const [text, language] of cases)
    assert.equal(detectLanguage(text), language, text);
});

test("every reply language passes the policy gates on a fraud case", () => {
  for (const language of REPLY_LANGUAGES) {
    const result = triage({
      message:
        "Someone called for KYC, I installed AnyDesk and ₹18,000 was debited. UTR 765432109812",
      language: language.code,
    });
    assert.equal(result.payload.detected_language, language.code);
    assert.equal(result.audit.no_unauthorized_promises, true, language.code);
    assert.equal(result.audit.fraud_rails_present, true, language.code);
    assert.ok(result.reply.text.includes("765432109812"), language.code);
  }
});
