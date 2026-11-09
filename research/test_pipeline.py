import copy
import json
import tempfile
import unittest
from pathlib import Path
from phase1_curatorkit_pipeline import curate
from phase3_auditkit_eval import align_predictions, paired_bootstrap, score_prediction
from research.common import ROOT, extraction_reward, read_jsonl, schema_valid, strict_json

class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.rows = read_jsonl(ROOT / "data/seeds/synthetic_cases.jsonl")
        self.target = self.rows[0]["target"]
    def test_full_reward(self):
        self.assertEqual(extraction_reward(json.dumps(self.target), self.target), 1.0)
        for key, value in [("amount_inr", 99999), ("mandatory_actions", ["CONTACT_BANK_PSP"]), ("utr_number", "111111111111")]:
            wrong = {**self.target, key:value}
            self.assertLess(extraction_reward(json.dumps(wrong),self.target), .3)
    def test_invalid_outputs_never_get_schema_credit(self):
        for value in ["```json\n{}\n```", "{} extra", "null", "[]", '{"utr_number":null,"utr_number":null}', json.dumps({**self.target,"amount_inr": True}),json.dumps({**self.target,"amount_inr": float("nan")}),json.dumps({**self.target,"detected_language": []})]:
            self.assertEqual(extraction_reward(value,self.target), -1.0, value)
            self.assertEqual(score_prediction(value,self.target)["schema_pass"],0.0)
    def test_all_fields_and_dual_contract(self):
        reply = "Notify bank and call 1930, report at cybercrime.gov.in"
        r = score_prediction(json.dumps(self.target)+"\n---REPLY---\n"+reply,self.target)
        self.assertEqual(r["all_fields_exact"],1)
        self.assertEqual(r["dual_contract_pass"],1)
        r = score_prediction(json.dumps(self.target),self.target)
        self.assertEqual(r["dual_contract_pass"],0)
    def test_unsafe_refund_pattern(self):
        r=score_prediction(json.dumps(self.target)+"\n---REPLY---\nYour refund is 100% guaranteed", self.target)
        self.assertEqual(r["unauthorized_guarantee_pattern_rate"],1)
        self.assertEqual(r["required_fraud_rails"],0)
    def test_prediction_alignment_cannot_drop_cases(self):
        samples=[{"sample_id":"a"},{"sample_id":"b"}]
        with self.assertRaises(ValueError): align_predictions(samples,[{"sample_id":"a","prediction":"x"}])
        with self.assertRaises(ValueError): align_predictions(samples,[{"sample_id":"a","prediction":"x"},{"sample_id":"a","prediction":"x"}])
    def test_scenario_group_leakage_rejected(self):
        rows=copy.deepcopy(self.rows[:2]);rows[1]["split"]="test"
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError): curate(rows,Path(tmp))
    def test_curation_gates_and_scrubbed_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            m=curate(self.rows,Path(tmp))
            self.assertEqual(m["accepted"],18)
            self.assertTrue(m["bootstrap_only"])
            text="\n".join(p.read_text() for p in Path(tmp).rglob("*.jsonl"))
            for secret in ["9876543210", "123456789012", "ABCDE1234F"]:
                self.assertNotIn(secret,text)
            self.assertEqual(m["split_counts"]["train"]["dpo"],10)
    def test_ungrounded_gold_rejected(self):
        rows=copy.deepcopy(self.rows[:1]);rows[0]["target"]["utr_number"]="999999999999"
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(curate(rows,Path(tmp))["rejected"],1)
    def test_bootstrap_paired_and_reproducible(self):
        samples=[{"scenario_group":"a"},{"scenario_group":"a"},{"scenario_group":"b"}]
        left=[{"utility":0.0}]*3;right=[{"utility":1.0}]*3
        result=paired_bootstrap(samples,left,right,repeats=100)
        self.assertEqual(result["ci_95"],[1.0,1.0])
        self.assertEqual(result,paired_bootstrap(samples,left,right,repeats=100))
    def test_golds_are_strict(self):
        for row in self.rows:self.assertTrue(schema_valid(row["target"]))
if __name__ == "__main__":unittest.main()
