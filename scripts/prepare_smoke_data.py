"""Create a tiny, explicitly synthetic-only dataset under artifacts/smoke-test."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from research.common import ROOT,read_jsonl
from phase1_curatorkit_pipeline import curate

def main():
 p=argparse.ArgumentParser();p.add_argument("--output",type=Path,default=ROOT/"artifacts/smoke-test/data");a=p.parse_args()
 if not a.output.resolve().is_relative_to((ROOT/'artifacts/smoke-test').resolve()): raise ValueError('Smoke data must remain under artifacts/smoke-test')
 seeds=read_jsonl(ROOT/"data/seeds/synthetic_cases.jsonl")
 rows=[r for r in seeds if r["split"]=="train"][:2]
 for r in rows:r.update(origin="synthetic",synthetic_status="smoke_fixture_only",label_status="synthetic_smoke_fixture",human_reviewed=False,usage="development")
 m=curate(rows,a.output,use_curatorkit=True,grouped_split=False)
 m["smoke_test_only"]=True;m["source_data"]="bundled synthetic fixtures";m["human_reviewed_count"]=0
 (a.output/"manifest.json").write_text(json.dumps(m,indent=2)+"\n")
 print(json.dumps({"accepted":m["accepted"],"smoke_test_only":True,"human_reviewed":0,"output":str(a.output)},indent=2))
if __name__=="__main__":main()
