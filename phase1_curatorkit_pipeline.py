"""Provenance-gated bootstrap curation; optional real CuratorKIT/Presidio passes.

Default is local/offline. Outputs are explicitly synthetic, not a validated corpus.
"""
from __future__ import annotations
import argparse
import importlib.metadata
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from research.common import ROOT, digest, engine_batch, no_guarantee, payload_matches, prompt_for, read_jsonl, required_rails, schema_valid, write_jsonl

def presidio_scrub(text):
    """Run Presidio after contextual masking; protect only labelled UTRs."""
    from presidio_analyzer import AnalyzerEngine
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig
    anchors = {}
    def protect(match):
        # A numbered token, so the placeholder survives past 26 anchors.
        token = f"REFANCHOR{len(anchors)}TOKEN"
        anchors[token] = match.group(1)
        return match.group(0).replace(match.group(1), token)
    protected = re.sub(r"\b(?:UTR|RRN|ref(?:erence)?(?:\s*(?:no\.?|number))?)\s*[:#=-]?\s*(\d{12})\b", protect, text, flags=re.I)
    analyzer = AnalyzerEngine()
    supported = analyzer.get_supported_entities(language="en")
    wanted = [e for e in ["PHONE_NUMBER", "EMAIL_ADDRESS", "PERSON", "LOCATION", "CREDIT_CARD", "IBAN_CODE", "IN_AADHAAR", "IN_PAN"] if e in supported]
    entities = analyzer.analyze(text=protected, language="en", entities=wanted)
    # Placeholder anchors cannot be removed by a generic recognizer.
    protected_spans = [m.span() for m in re.finditer(r"REFANCHOR\d+TOKEN", protected)]
    entities = [e for e in entities if not any(e.start < b and e.end > a for a, b in protected_spans)]
    result = AnonymizerEngine().anonymize(text=protected, analyzer_results=entities, operators={"DEFAULT": OperatorConfig("replace", {"new_value": "[PII_REDACTED]"})}).text
    for key, value in anchors.items():
        result = result.replace(key, value)
    return result

def curate(rows, output, use_presidio=False, use_curatorkit=False):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    seen_ids, group_splits, hashes = set(), {}, set()
    for row in rows:
        if row["sample_id"] in seen_ids:
            raise ValueError("Duplicate sample ID")
        seen_ids.add(row["sample_id"])
        if row["split"] not in {"train", "validation", "test"}:
            raise ValueError("Unknown split")
        group, split = row["scenario_group"], row["split"]
        if group in group_splits and group_splits[group] != split:
            raise ValueError("Scenario-group split leakage")
        group_splits[group] = split
        if row.get("origin") != "synthetic" and not row.get("consent_reference"):
            raise ValueError("Real records require an explicit consent/provenance reference")
    traces = engine_batch([row["input"] for row in rows])
    reply_inputs = []
    for row, trace in zip(rows, traces, strict=True):
        reply_inputs.extend([{"message": row.get("chosen_reply") or trace["reply"]["text"]}, {"message": row.get("rejected_reply") or "No rejected response"}])
    reply_traces = engine_batch(reply_inputs)
    exports = {s: {"rlvr": [], "dpo": [], "sft": [], "uncurated_sft": [], "benchmark": []} for s in ("train", "validation", "test")}
    accepted, rejected, repairs = [], [], []
    for index, (row, trace) in enumerate(zip(rows, traces, strict=True)):
        sanitized = trace["privacy"]["sanitized"]
        if use_presidio:
            sanitized = presidio_scrub(sanitized)
        key = digest(sanitized.casefold().split())
        if key in hashes:
            rejected.append({"sample_id": row["sample_id"], "reason": "exact_duplicate"})
            continue
        hashes.add(key)
        payload = row["target"]
        failures = []
        if not schema_valid(payload):
            rejected.append({"sample_id":row["sample_id"],"reason":["schema_invalid"],"sanitized_input":sanitized})
            continue
        if not payload_matches(trace["payload"], payload):
            failures.append("bootstrap_target_disagrees_with_independent_engine_check")
        if payload.get("utr_number") and payload["utr_number"] not in sanitized:
            failures.append("utr_not_grounded")
        reply = reply_traces[index*2]["privacy"]["sanitized"]
        if use_presidio:
            reply = presidio_scrub(reply)
        if not no_guarantee(reply) or not required_rails(reply, payload):
            failures.append("reply_policy_pattern_gate")
        if failures:
            rejected.append({"sample_id": row["sample_id"], "reason": failures, "sanitized_input": sanitized})
            continue
        context = {k: v for k, v in row["input"].items() if k != "message"}
        prompt = prompt_for(sanitized, context, "schema")
        reply_prompt_base = prompt_for(sanitized, context, "reply")
        reply_prompt = reply_prompt_base + "\nTRIAGE CONTEXT (verify against the message):\n" + json.dumps(payload, ensure_ascii=False)
        dual_prompt = prompt_for(sanitized, context)
        provenance = {"sample_id": row["sample_id"], "scenario_group": row["scenario_group"], "split": row["split"], "origin": row["origin"], "sanitized_sha256": digest(sanitized.encode()), "policy_version": trace["audit"]["policy_version"], "source_ids": trace["audit"]["source_ids"], "evidence": trace["evidence"], "human_reviewed": bool(row.get("human_reviewed", False))}
        split = exports[row["split"]]
        split["rlvr"].append({"prompt": prompt, "answer": json.dumps(payload, ensure_ascii=False), "ground_truth_json": payload, "provenance": provenance})
        split["sft"].extend([{"instruction": prompt, "input": "", "output": json.dumps(payload, ensure_ascii=False), "provenance": provenance}, {"instruction": reply_prompt, "input": "", "output": reply, "provenance": provenance}])
        # Uncurated baseline is still PII-scrubbed and uses the same train split.
        bad_reply = reply_traces[index*2+1]["privacy"]["sanitized"] if row.get("rejected_reply") else None
        if bad_reply and use_presidio:
            bad_reply = presidio_scrub(bad_reply)
        if bad_reply:
            split["uncurated_sft"].extend([{"instruction": prompt, "input": "", "output": json.dumps(payload, ensure_ascii=False), "provenance": provenance}, {"instruction": reply_prompt, "input": "", "output": bad_reply, "provenance": provenance}])
            if bad_reply != reply and not no_guarantee(bad_reply):
                split["dpo"].append({"prompt": reply_prompt, "chosen": reply, "rejected": bad_reply, "diagnostic_reason": "unsupported_guarantee", "provenance": provenance})
                repairs.append({**provenance, "diagnostic_label": "parametric_leakage", "rejected": bad_reply, "chosen": reply, "recovery": "deterministic_template_replacement", "gate_rechecked": True})
        split["benchmark"].append({"sample_id": row["sample_id"], "scenario_group": row["scenario_group"], "input": dual_prompt, "schema_prompt": prompt, "reply_prompt": reply_prompt_base, "target": json.dumps(payload, ensure_ascii=False), "reference_reply": reply, "provenance": provenance})
        accepted.append(provenance)
    for name, datasets in exports.items():
        for kind, records in datasets.items():
            write_jsonl(output / name / f"{kind}.jsonl", records)
    write_jsonl(output / "accepted.jsonl", accepted)
    write_jsonl(output / "rejected.jsonl", rejected)
    write_jsonl(output / "recovery_pairs.jsonl", repairs)
    owned_files = [output / split / f"{kind}.jsonl" for split, datasets in exports.items() for kind in datasets] + [output/name for name in ("accepted.jsonl","rejected.jsonl","recovery_pairs.jsonl")]
    toolkit = "not_run"
    if use_curatorkit:
        from curatorkit import Curator, CuratorConfig
        Curator(CuratorConfig(dataset=str((output / "train/sft.jsonl").resolve()), clean=True, dedup="exact", export_formats=["alpaca"], output_dir=str(output / "curatorkit"))).run()
        toolkit = importlib.metadata.version("curatorkit")
        owned_files += sorted((output/"curatorkit").rglob("*.jsonl"))
    manifest = {"created_at": datetime.now(timezone.utc).isoformat(), "accepted": len(accepted), "rejected": len(rejected), "empty_dataset": not accepted, "bootstrap_only": not all(p["human_reviewed"] for p in accepted) or not accepted, "pii_backend": "contextual_regex+presidio" if use_presidio else "contextual_regex", "curatorkit": toolkit, "gate_backend": "local_schema_numeric_and_policy_patterns", "scenario_group_splits": group_splits, "split_counts": {s: {k: len(v) for k, v in d.items()} for s, d in exports.items()}, "files": {str(p.relative_to(output)): digest(p.read_bytes()) for p in sorted(owned_files)}}
    if not accepted:
        # An empty dataset is valid but must never look like a healthy run.
        print("WARNING: no sample passed the curation gates; the dataset is empty. Inspect rejected.jsonl.", file=sys.stderr)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (output / "dataset_card.md").write_text("# Suraksha bootstrap data\n\nSynthetic seed records. Not representative, independently annotated or sufficient for production training. Rule-derived customer drafts require regional-language human review. Scenario groups are isolated across splits. No LLM synthesis, semantic HallucinationGate or RewardRefiner was run in local mode. Repaired pairs are explicitly labelled template replacements.\n")
    return manifest

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "data/seeds/synthetic_cases.jsonl")
    parser.add_argument("--output", type=Path, default=ROOT / "data/generated")
    parser.add_argument("--demo", action="store_true", help="Use bundled synthetic seeds (also the default)")
    parser.add_argument("--presidio", action="store_true", help="Requires Presidio and its configured NLP model")
    parser.add_argument("--use-curatorkit", action="store_true", help="Run an actual CuratorKIT clean/dedup/export pass after the local gates")
    args = parser.parse_args()
    manifest=curate(read_jsonl(args.input), args.output, args.presidio, args.use_curatorkit)
    print(json.dumps(manifest,indent=2))
    if manifest["empty_dataset"]:raise SystemExit(2)
if __name__ == "__main__":
    main()
