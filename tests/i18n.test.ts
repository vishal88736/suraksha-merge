import test from "node:test";
import assert from "node:assert/strict";
import { triage } from "../lib/engine.ts";
import { SCENARIOS } from "../lib/content/scenarios.ts";
import { catalogs, translate } from "../lib/i18n/catalog.ts";
import { REPLY_TEMPLATES } from "../lib/i18n/replies.ts";
import { REPLY_LANGUAGES, UI_LOCALES } from "../lib/i18n/locales.ts";
import { detectLanguage } from "../lib/rules/language.ts";

test("every interface locale covers every message key", () => {
  for (const locale of UI_LOCALES) {
    const catalog = catalogs[locale.code];
    for (const key of Object.keys(catalogs.en) as (keyof typeof catalogs.en)[])
      assert.equal(typeof catalog[key], "string", `${locale.code}.${key}`);
    // No translation may be an empty string.
    for (const [key, value] of Object.entries(catalog))
      assert.ok(value.trim().length > 0, `${locale.code}.${key}`);
  }
});

test("every reply language has a complete template bundle", () => {
  for (const language of REPLY_LANGUAGES) {
    const bundle = REPLY_TEMPLATES[language.code];
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
  for (const bundle of Object.values(REPLY_TEMPLATES)) {
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
