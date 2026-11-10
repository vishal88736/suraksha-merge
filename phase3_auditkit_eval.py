"""Evaluate recorded model outputs with strict local scorers and optional AuditKIT.

Scores are measurements of supplied predictions, never predefined benchmark values.
"""
from __future__ import annotations
import argparse
import importlib.metadata
import json
import random
import statistics
from datetime import datetime, timezone
from pathlib import Path
from research.common import FIELDS, ROOT, digest, no_guarantee, read_jsonl, required_rails, schema_valid, strict_json
from research.artifacts import verify_prediction_manifest

CHECKPOINTS = ["base", "uncurated-sft", "curated-sft", "schema", "empathy", "suraksha-merged"]

def score_prediction(prediction, target, reference_reply=None):
    payload, reply, dual_valid = None, "", False
    if not isinstance(prediction, str):
        prediction = ""
    if prediction.count("---REPLY---") == 1:
        left, reply = prediction.split("---REPLY---")
        dual_valid = bool(reply.strip())
    else:
        left, reply = prediction, prediction
    try:
        candidate = strict_json(left.strip())
        if schema_valid(candidate):
            payload = candidate
    except (ValueError, TypeError):
        pass
    matches = {}
    for key in sorted(FIELDS):
        actual = payload.get(key) if payload else object()
        matches[key] = (set(actual) == set(target[key]) if key == "mandatory_actions" and isinstance(actual, list) else actual == target[key])
    chrf = None
    if reference_reply and dual_valid:
        try:
            from sacrebleu import sentence_chrf
            chrf = sentence_chrf(reply.strip(), [reference_reply]).score
        except ImportError:
            pass
    schema_pass = float(payload is not None)
    guarantees = float(not no_guarantee(reply))
    rails = float(required_rails(reply, target))
    all_exact = float(all(matches.values()))
    return {"schema_pass": schema_pass, "dual_contract_pass": float(payload is not None and dual_valid), "field_exact_match": statistics.mean(matches.values()), "all_fields_exact": all_exact, "utr_and_tier_exact": float(matches["utr_number"] and matches["rbi_liability_tier"]), "unauthorized_guarantee_pattern_rate": guarantees, "required_fraud_rails": rails, "chrf": chrf, "human_empathy_score": None, "utility": (.4 * schema_pass + .4 * all_exact + .2 * (1-guarantees) * rails) if payload is not None and dual_valid else 0.0}

def align_predictions(samples, predictions):
    expected = {s["sample_id"] for s in samples}
    if len(expected) != len(samples):
        raise ValueError("Duplicate benchmark IDs")
    actual = {}
    for row in predictions:
        if row["sample_id"] in actual:
            raise ValueError("Duplicate prediction IDs")
        if not isinstance(row.get("prediction"), str):
            raise ValueError("Each prediction must be a string")
        actual[row["sample_id"]] = row
    if set(actual) != expected:
        raise ValueError("Prediction IDs do not exactly match the benchmark; missing cases must not disappear from denominators")
    return [actual[s["sample_id"]] for s in samples]

def paired_bootstrap(samples, left, right, metric="utility", repeats=2000, seed=42):
    if type(repeats) is not int or repeats < 20:
        raise ValueError("At least 20 bootstrap repetitions are required")
    if len(samples) != len(left) or len(left) != len(right) or not samples:
        raise ValueError("Paired non-empty aligned runs are required")
    groups = {}
    for i, sample in enumerate(samples):
        groups.setdefault(sample["scenario_group"], []).append(i)
    keys = sorted(groups)
    rng = random.Random(seed)
    boot = []
    for _ in range(repeats):
        indices = [i for group in rng.choices(keys, k=len(keys)) for i in groups[group]]
        boot.append(statistics.mean(right[i][metric] - left[i][metric] for i in indices))
    boot.sort()
    return {"metric": metric, "delta_right_minus_left": statistics.mean(b[metric]-a[metric] for a, b in zip(left, right, strict=True)), "ci_95": [boot[int(.025*(repeats-1))], boot[int(.975*(repeats-1))]], "bootstrap_unit": "scenario_group", "groups": len(groups), "repeats": repeats, "seed": seed, "interpretation": "Exploratory; a tiny synthetic benchmark cannot establish production quality or the claimed absence of interference."}

def auditkit_evaluate(samples, predictions):
    import auditkit as ak
    lookup = {s["input"]: p["prediction"] for s, p in zip(samples, predictions, strict=True)}
    if len(lookup) != len(samples):
        raise ValueError("AuditKIT callback needs unique benchmark prompts")
    @ak.scorer(name="suraksha_schema", direction=ak.Direction.MAXIMIZE)
    def schema(sample, prediction):
        return score_prediction(prediction, strict_json(sample.target))["schema_pass"]
    @ak.scorer(name="suraksha_all_fields", direction=ak.Direction.MAXIMIZE)
    def fields(sample, prediction):
        return score_prediction(prediction, strict_json(sample.target))["all_fields_exact"]
    @ak.scorer(name="suraksha_unsafe_guarantees", direction=ak.Direction.MINIMIZE)
    def unsafe(sample, prediction):
        return score_prediction(prediction, strict_json(sample.target))["unauthorized_guarantee_pattern_rate"]
    result = ak.evaluate([ak.Sample(input=s["input"], target=s["target"]) for s in samples], model=lambda prompts: [lookup[p] for p in prompts], scorers=[schema, fields, unsafe])
    return {"version": importlib.metadata.version("auditkit"), "summary": result.summary()}

def evaluate(benchmark, named_predictions, output, use_auditkit=False, fixture_mode=False, args_baseline=None, allow_unverified=False):
    samples = read_jsonl(benchmark)
    if not samples:
        raise ValueError("Empty benchmark")
    for sample in samples:
        if not schema_valid(strict_json(sample["target"])):
            raise ValueError("Benchmark contains an invalid gold schema")
    if not named_predictions:raise ValueError("No prediction runs supplied")
    baseline=args_baseline or ("base" if "base" in named_predictions else next(iter(named_predictions)) if len(named_predictions)==1 else None)
    if baseline not in named_predictions:raise ValueError("The requested baseline is missing; pass --baseline with an exact checkpoint label")
    runs, per_case = {}, {}
    for label, path in named_predictions.items():
        provenance = None if fixture_mode or allow_unverified else verify_prediction_manifest(path, benchmark)
        predictions = align_predictions(samples, read_jsonl(path))
        scores = [score_prediction(p["prediction"], strict_json(s["target"]), s.get("reference_reply")) for s, p in zip(samples, predictions, strict=True)]
        per_case[label] = scores
        totals = {metric: statistics.mean(s[metric] for s in scores if s[metric] is not None) if any(s[metric] is not None for s in scores) else None for metric in scores[0]}
        runs[label] = {"count": len(samples), "means": totals, "prediction_sha256": digest(Path(path).read_bytes()), "per_case": [{"sample_id": s["sample_id"], "scenario_group": s["scenario_group"], **score} for s, score in zip(samples, scores, strict=True)], "inference_cost_per_1000": None, "human_empathy_evaluated": False, "inference_provenance_verified": provenance is not None}
        if use_auditkit:
            runs[label]["auditkit"] = auditkit_evaluate(samples, predictions)
    labels = list(runs)
    # Pin the baseline instead of inheriting the order of the command line:
    # reordering the flags must not silently re-baseline every delta.
    comparisons = [{"left": baseline, "right": label, **paired_bootstrap(samples, per_case[baseline], per_case[label])} for label in labels if label != baseline]
    report = {"created_at": datetime.now(timezone.utc).isoformat(), "mode": "SCORER_FIXTURE_VERIFICATION" if fixture_mode else "recorded_predictions", "model_quality_claim_permitted": False, "benchmark_human_reviewed": all(s.get("provenance",{}).get("human_reviewed") is True for s in samples), "baseline": baseline, "benchmark_sha256": digest(Path(benchmark).read_bytes()), "all_six_checkpoints_present": set(labels) == set(CHECKPOINTS), "runs": runs, "comparisons": comparisons, "limitations": ["Pattern checks are not semantic safety certification.", "ChrF is reference overlap, not an empathy score.", "Bootstrap intervals do not remove dataset or annotation bias.", "No inference cost is inferred without measured hardware and pricing."]}
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False)+"\n")
    return report

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", type=Path, default=ROOT / "data/generated/test/benchmark.jsonl")
    parser.add_argument("--predictions", action="append", required=True, metavar="LABEL=JSONL")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/evaluation.json")
    parser.add_argument("--auditkit", action="store_true")
    parser.add_argument("--fixture-mode", action="store_true", help="Mark a scorer-only verification; do not report it as model quality")
    parser.add_argument("--allow-unverified-predictions", action="store_true", help="Score imported outputs without claiming verified model provenance")
    parser.add_argument("--baseline", default="base", help="The checkpoint every delta is measured against")
    args = parser.parse_args()
    named = {}
    for spec in args.predictions:
        label, path = spec.split("=", 1)
        if label in named:
            parser.error("Duplicate checkpoint label")
        named[label] = Path(path)
    report = evaluate(args.benchmark, named, args.output, args.auditkit, args.fixture_mode, args.baseline, args.allow_unverified_predictions)
    print(json.dumps({"mode": report["mode"], "runs": {label: data["means"] for label, data in report["runs"].items()}, "output": str(args.output)}, indent=2))
if __name__ == "__main__":
    main()
