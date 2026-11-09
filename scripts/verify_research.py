"""Check scorer plumbing on clearly labelled fixtures, never model predictions."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from research.common import ROOT, read_jsonl, write_jsonl
from phase3_auditkit_eval import evaluate

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--auditkit",action="store_true")
    args=parser.parse_args()
    benchmark=ROOT / "data/generated/test/benchmark.jsonl"
    samples=read_jsonl(benchmark)
    good, bad=[],[]
    for row in samples:
        good.append({"sample_id":row["sample_id"],"prediction":row["target"]+"\n---REPLY---\n"+row["reference_reply"]})
        bad.append({"sample_id":row["sample_id"],"prediction":"{broken JSON\n---REPLY---\nYour refund is 100% guaranteed. Instant reversal approved."})
    out=ROOT / "artifacts/scorer-fixtures"
    write_jsonl(out/"valid.jsonl",good)
    write_jsonl(out/"unsafe.jsonl",bad)
    report=evaluate(benchmark,{"fixture-valid":out/"valid.jsonl","fixture-unsafe":out/"unsafe.jsonl"},out/"verification.json",args.auditkit,True)
    assert report["runs"]["fixture-valid"]["means"]["schema_pass"]==1
    assert report["runs"]["fixture-unsafe"]["means"]["schema_pass"]==0
    assert report["runs"]["fixture-unsafe"]["means"]["unauthorized_guarantee_pattern_rate"]==1
    print(json.dumps({"mode":report["mode"],"fixtures":len(samples),"auditkit_executed":args.auditkit,"checks":"passed","model_inference_executed":False},indent=2))
if __name__=="__main__":main()
