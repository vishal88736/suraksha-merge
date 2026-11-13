import importlib.util
import json
import unittest
from research.common import ROOT, read_jsonl


@unittest.skipUnless(importlib.util.find_spec("auditkit"), "requires AuditKIT (.venv)")
class AuditKitEvaluationTests(unittest.TestCase):
    def test_distinct_predictions_never_replay_a_cached_run(self):
        # Regression: AuditKIT fingerprints callables by code + immutable captures,
        # so identical lambdas over different prediction dicts replayed the first
        # (perfect-score fixture) result for every later model.
        from phase3_auditkit_eval import auditkit_evaluate, score_prediction
        from research.common import strict_json
        samples = read_jsonl(ROOT / "data/seeds/synthetic_cases.jsonl")[:3]
        samples = [{"sample_id": str(i), "input": f"case {i}: {s['input']['message']}", "target": json.dumps(s["target"])} for i, s in enumerate(samples)]
        perfect = [{"prediction": s["target"]} for s in samples]
        broken = [{"prediction": "JSON: " + s["target"]} for s in samples]
        def means(preds):
            scores = [score_prediction(p["prediction"], strict_json(s["target"])) for s, p in zip(samples, preds)]
            return {k: sum(x[k] for x in scores) / len(scores) for k in ("schema_pass", "all_fields_exact", "unauthorized_guarantee_pattern_rate")}
        good = auditkit_evaluate(samples, perfect, means(perfect))
        bad = auditkit_evaluate(samples, broken, means(broken))
        self.assertNotEqual(good["fingerprint"], bad["fingerprint"])
        self.assertEqual(good["metric_means"]["suraksha_schema"], 1.0)
        self.assertEqual(bad["metric_means"]["suraksha_schema"], 0.0)
        with self.assertRaises(RuntimeError):  # a disagreeing result is never reported
            auditkit_evaluate(samples, broken, {**means(broken), "schema_pass": 1.0})


if __name__ == "__main__":
    unittest.main()
