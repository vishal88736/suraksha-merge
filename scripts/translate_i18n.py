"""Translate the interface and the reply templates into the 22 scheduled languages.

Uses AI4Bharat IndicTrans2 (MIT): ai4bharat/indictrans2-en-indic-1B forward
and ai4bharat/indictrans2-indic-en-1B for back-translation checks. Both repos
are gated: accept the terms on Hugging Face and run `hf auth login` first.

    node scripts/i18n-source.ts > artifacts/i18n/source.json
    .venv-i18n/bin/python scripts/translate_i18n.py            # all languages
    .venv-i18n/bin/python scripts/translate_i18n.py --langs bn ta --skip-back

Safety properties (each is checked, and a failure is never written silently):
- Placeholders ({utr}, {deadline}, ...) and rail terms (1930,
  cybercrime.gov.in, bank/PSP, UTR, RBI, ...) are passed through IndicTrans2's
  own <ID> placeholder mechanism and must come back exactly once each.
- Every translation is back-translated to English. A reply template whose
  English source has a negation ("cannot", "never", "no ...") must keep one,
  and must not gain an unnegated "guarantee"/"approved"/"100%": a lost
  negation in "a refund cannot be confirmed" would turn it into a promise.
- A string that fails a check falls back to English in the interface. A reply
  template that fails a check fails the run for that language unless it is
  listed in --accept with a human justification.

Outputs: lib/i18n/generated/<ui>.ts, lib/i18n/generated/replies.ts and the
QA report artifacts/i18n/qa.json (summary in lib/i18n/generated/QA.md).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "lib/i18n/generated"

# ui code, reply code, FLORES code -- keep in step with lib/i18n/locales.ts.
LANGUAGES = [
    ("as", "assamese", "asm_Beng"), ("bn", "bengali", "ben_Beng"), ("brx", "bodo", "brx_Deva"),
    ("doi", "dogri", "doi_Deva"), ("gu", "gujarati", "guj_Gujr"), ("kn", "kannada", "kan_Knda"),
    ("ks", "kashmiri", "kas_Arab"), ("kok", "konkani", "gom_Deva"), ("mai", "maithili", "mai_Deva"),
    ("ml", "malayalam", "mal_Mlym"), ("mni", "manipuri", "mni_Mtei"), ("mr", "marathi", "mar_Deva"),
    ("ne", "nepali", "npi_Deva"), ("or", "odia", "ory_Orya"), ("pa", "punjabi", "pan_Guru"),
    ("sa", "sanskrit", "san_Deva"), ("sat", "santali", "sat_Olck"), ("sd", "sindhi", "snd_Arab"),
    ("ta", "tamil", "tam_Taml"), ("te", "telugu", "tel_Telu"), ("ur", "urdu", "urd_Arab"),
]

# Terms that must survive verbatim, longest first. "bank/PSP" is reply-only:
# the runtime fraud gate requires the Latin word "bank" in fraud replies.
COMMON_TERMS = [
    "IN-UPI-2026-11-09", "cybercrime.gov.in", "cms.rbi.org.in", "Qwen2.5-3B-Instruct", "Qwen2.5-3B",
    "Suraksha-Merge", "SurakshaDesk", "Sūrakṣha", "CuratorKIT", "AlignTune", "AuditKIT", "Presidio",
    "Cloudflare", "DR-GRPO", "QLoRA", "LoRA", "GRPO", "RLVR", "SFT", "DPO", "chrF", "JSON", "API",
    "PII", "SLA", "UTR/RRN", "UTR", "RRN", "PIN/OTP", "PIN", "OTP", "VPA", "UPI", "NPCI", "RBI",
    "PSP", "SMS", "BSBD", "UDIR", "I4C", "OLX", "Swiggy", "AnyDesk", "1930",
]
REPLY_TERMS = ["bank/PSP"]
TOKEN_PATTERNS = [r"T\+\{\w+\}", r"T\+\d", r"₹\{\w+\}", r"₹[\d,]+", r"\{\w+\}"]

NEGATION = re.compile(r"\b(?:not|never|no|cannot|without|nothing|none|neither|nor)\b|n't", re.I)
PROMISE = re.compile(r"guarantee|approved|100\s*%", re.I)


def protector(extra_terms: list[str]):
    terms = sorted(COMMON_TERMS + extra_terms, key=len, reverse=True)
    parts = TOKEN_PATTERNS + [re.escape(t) for t in terms]
    return re.compile("|".join(f"(?:{p})" for p in parts))


def mask(text: str, pattern: re.Pattern) -> tuple[str, list[str]]:
    """Replace protected spans with URL-shaped tokens that IndicTransToolkit
    wraps in its own <IDn> placeholders and restores verbatim."""
    found: list[str] = []

    def sub(match: re.Match) -> str:
        found.append(match.group(0))
        return f"zq{len(found)}.zz"

    return pattern.sub(sub, text), found


def unmask(text: str, found: list[str]) -> tuple[str, list[str]]:
    errors = []
    for i, term in enumerate(found, start=1):
        token = f"zq{i}.zz"
        n = text.count(token)
        if n != 1:
            errors.append(f"placeholder {term!r} appears {n}x")
        text = text.replace(token, term)
    if re.search(r"zq\d+\.zz|<\s*ID\s*\d+\s*>", text):
        errors.append("stray placeholder")
    return text, errors


def flatten(obj, prefix=""):
    if isinstance(obj, str):
        yield prefix, obj
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from flatten(v, f"{prefix}[{i}]")
    else:
        for k, v in obj.items():
            yield from flatten(v, f"{prefix}.{k}" if prefix else k)


def rebuild(template, values: dict[str, str], prefix=""):
    if isinstance(template, str):
        return values[prefix]
    if isinstance(template, list):
        return [rebuild(v, values, f"{prefix}[{i}]") for i, v in enumerate(template)]
    return {k: rebuild(v, values, f"{prefix}.{k}" if prefix else k) for k, v in template.items()}


class Translator:
    def __init__(self, name: str, batch: int, beams: int):
        import torch
        from IndicTransToolkit.processor import IndicProcessor
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(name, trust_remote_code=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            name, trust_remote_code=True, torch_dtype=torch.float16
        ).to("cuda").eval()
        self.ip = IndicProcessor(inference=True)
        self.batch, self.beams = batch, beams

    def __call__(self, texts: list[str], src: str, tgt: str, beams: int | None = None) -> list[str]:
        out: list[str | None] = [None] * len(texts)
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        for start in range(0, len(order), self.batch):
            idx = order[start:start + self.batch]
            batch = self.ip.preprocess_batch([texts[i] for i in idx], src_lang=src, tgt_lang=tgt)
            enc = self.tokenizer(batch, truncation=True, padding="longest", return_tensors="pt",
                                 return_attention_mask=True).to("cuda")
            with self.torch.inference_mode():
                gen = self.model.generate(**enc, use_cache=True, min_length=0, max_length=320,
                                          num_beams=beams or self.beams, num_return_sequences=1)
            decoded = self.tokenizer.batch_decode(gen, skip_special_tokens=True,
                                                  clean_up_tokenization_spaces=True)
            for i, text in zip(idx, self.ip.postprocess_batch(decoded, lang=tgt)):
                out[i] = text
        return out  # type: ignore[return-value]

    def close(self):
        del self.model
        self.torch.cuda.empty_cache()


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_locale(ui: str, messages: dict[str, str], content: dict[str, str], header: str):
    lines = [header, 'import type { LocaleBundle } from "../catalog.ts";', "",
             "const bundle: LocaleBundle = {", "  messages: {"]
    lines += [f"    {ts_string(k)}: {ts_string(v)}," for k, v in messages.items()]
    lines += ["  },", "  content: {"]
    lines += [f"    {ts_string(k)}:\n      {ts_string(v)}," for k, v in content.items()]
    lines += ["  },", "};", "", "export default bundle;", ""]
    (GENERATED / f"{ui}.ts").write_text("\n".join(lines), encoding="utf-8")


def write_replies(bundles: dict[str, dict], header: str):
    codes = list(bundles)
    body = json.dumps(bundles, ensure_ascii=False, indent=2)
    text = "\n".join([
        header,
        'import type { ReplyTemplates } from "../replies-authored.ts";', "",
        "export type GeneratedReplyLanguage =",
        *[f"  | {ts_string(c)}" for c in codes][:-1], f"  | {ts_string(codes[-1])};", "",
        "export const GENERATED_REPLIES: Record<GeneratedReplyLanguage, ReplyTemplates> = " + body + ";", "",
    ])
    (GENERATED / "replies.ts").write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default=str(ROOT / "artifacts/i18n/source.json"))
    parser.add_argument("--report", default=str(ROOT / "artifacts/i18n/qa.json"))
    parser.add_argument("--langs", nargs="*", help="UI codes; default all 21 generated languages")
    parser.add_argument("--forward-model", default="ai4bharat/indictrans2-en-indic-1B")
    parser.add_argument("--back-model", default="ai4bharat/indictrans2-indic-en-1B")
    parser.add_argument("--batch", type=int, default=24)
    parser.add_argument("--beams", type=int, default=5)
    parser.add_argument("--skip-back", action="store_true", help="skip back-translation (no reply safety check; dev only)")
    parser.add_argument("--accept", nargs="*", default=[], help="lang:reply.path entries accepted after human review")
    parser.add_argument("--no-write", action="store_true")
    args = parser.parse_args()

    source = json.loads(Path(args.source).read_text(encoding="utf-8"))
    langs = [l for l in LANGUAGES if not args.langs or l[0] in args.langs]
    reply_pairs = dict(flatten(source["replies"]))
    segments = ([("message", k, v) for k, v in source["messages"].items()]
                + [("content", t, t) for t in source["content"]]
                + [("reply", k, v) for k, v in reply_pairs.items()])
    ui_pattern, reply_pattern = protector([]), protector(REPLY_TERMS)
    masked = []
    for kind, key, text in segments:
        m, found = mask(text, reply_pattern if kind == "reply" else ui_pattern)
        masked.append((kind, key, text, m, found))

    report = json.loads(Path(args.report).read_text()) if Path(args.report).exists() else {}
    forward = Translator(args.forward_model, args.batch, args.beams)
    results: dict[str, list[dict]] = {}
    for ui, reply_code, flores in langs:
        t0 = time.time()
        outs = forward([m for *_, m, _ in masked], "eng_Latn", flores)
        rows = []
        retry = []
        for i, ((kind, key, text, m, found), out) in enumerate(zip(masked, outs)):
            value, errors = unmask(out, found)
            rows.append({"kind": kind, "key": key, "source": text, "text": value, "errors": errors})
            if errors:
                retry.append(i)
        if retry:  # one retry with greedy decoding for placeholder failures
            outs2 = forward([masked[i][3] for i in retry], "eng_Latn", flores, beams=1)
            for i, out in zip(retry, outs2):
                value, errors = unmask(out, masked[i][4])
                if not errors:
                    rows[i].update(text=value, errors=[], retried=True)
        results[ui] = rows
        bad = sum(1 for r in rows if r["errors"])
        print(f"{ui}: {len(rows)} strings, {bad} placeholder failures, {time.time() - t0:.0f}s", flush=True)
    forward.close()

    if not args.skip_back:
        import sacrebleu
        back = Translator(args.back_model, args.batch, args.beams)
        for ui, reply_code, flores in langs:
            rows = results[ui]
            backs = back([r["text"] for r in rows], flores, "eng_Latn")
            for r, b in zip(rows, backs):
                r["back"] = b
                r["chrf"] = round(sacrebleu.sentence_chrf(b, [r["source"]]).score, 1)
                if r["kind"] == "reply" or NEGATION.search(r["source"]):
                    if NEGATION.search(r["source"]) and not NEGATION.search(b):
                        r["errors"].append("negation_lost")
                    if PROMISE.search(b) and not NEGATION.search(b):
                        r["errors"].append("promise_risk")
            print(f"{ui}: back-translated", flush=True)
        back.close()

    accepted = set(args.accept)
    header = ("// @generated by scripts/translate_i18n.py with AI4Bharat IndicTrans2 (MIT).\n"
              "// Machine translation: needs native-speaker review. Do not edit by hand;\n"
              "// fix the English source or the script and regenerate.")
    reply_bundles: dict[str, dict] = {}
    failed_langs = []
    for ui, reply_code, flores in langs:
        rows = results[ui]
        messages, content, replies = {}, {}, {}
        for r in rows:
            ok = not r["errors"]
            value = r["text"] if ok else r["source"]
            r["used"] = "translation" if ok else "english_fallback"
            if r["kind"] == "message":
                messages[r["key"]] = value
            elif r["kind"] == "content":
                content[r["key"]] = value
            else:
                if not ok and f"{ui}:{r['key']}" in accepted:
                    value, r["used"] = r["text"], "accepted_after_review"
                elif not ok:
                    failed_langs.append(f"{ui}:{r['key']}: {r['errors']}")
                replies[r["key"]] = value
        report[ui] = {"language": reply_code, "flores": flores, "rows": rows}
        if not args.no_write:
            write_locale(ui, messages, content, header)
            reply_bundles[reply_code] = rebuild(source["replies"], replies)

    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    if not args.no_write and not args.langs:
        write_replies(reply_bundles, header)
    elif not args.no_write:
        print("--langs given: replies.ts not rewritten (it needs every language)")
    if not args.no_write and not args.langs:
        write_qa(report, args.forward_model, args.back_model)
    if failed_langs:
        print("\nReply templates failing safety checks (English fallback written):", *failed_langs, sep="\n  ")
    return 0


def write_qa(report: dict, forward_model: str, back_model: str):
    lines = [
        "# Machine-translation QA", "",
        f"Generated by `scripts/translate_i18n.py` with `{forward_model}`; back-translation with `{back_model}`.",
        "These are **machine translations awaiting native-speaker review**. chrF compares the back-translation",
        "with the English source (0-100); it is a rough fidelity signal, not a quality score.", "",
        "| Language | Strings | Translated | English fallback | Reply templates translated | Reply checks failed | Mean chrF (UI) | Mean chrF (replies) |",
        "| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for ui, _, flores in LANGUAGES:
        if ui not in report:
            continue
        rows = report[ui]["rows"]
        replies = [r for r in rows if r["kind"] == "reply"]
        ui_rows = [r for r in rows if r["kind"] != "reply"]
        def mean(rs):
            vals = [r["chrf"] for r in rs if "chrf" in r]
            return f"{sum(vals) / len(vals):.1f}" if vals else "n/a"
        lines.append(
            f"| {report[ui]['language']} (`{flores}`) | {len(rows)} | "
            f"{sum(r['used'] != 'english_fallback' for r in rows)} | {sum(r['used'] == 'english_fallback' for r in rows)} | "
            f"{sum(r['used'] != 'english_fallback' for r in replies)}/{len(replies)} | "
            f"{sum(1 for r in replies if r['errors'])} | {mean(ui_rows)} | {mean(replies)} |")
    lines += ["", "Failed reply checks are listed per language in `artifacts/i18n/qa.json` (not committed).", ""]
    (GENERATED / "QA.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
