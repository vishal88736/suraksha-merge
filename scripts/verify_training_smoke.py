"""Validate synthetic smoke data/configuration without starting model training."""
import argparse,json,sys
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from research.common import ROOT,read_jsonl,strict_json,extraction_reward,no_guarantee,required_rails
from phase2_aligntune_train_and_merge import check_data,validate_smoke_options,TARGET_MODULES,package_versions

def verify(data):
    args=SimpleNamespace(data=Path(data),output=ROOT/'artifacts/smoke-test/checkpoints',allow_bootstrap_data=True,smoke_test=True,max_steps=1)
    manifest=check_data(args);validate_smoke_options(args)
    rlvr=read_jsonl(args.data/'train/rlvr.jsonl');dpo=read_jsonl(args.data/'train/dpo.jsonl')
    for row in rlvr:
        if not isinstance(row['prompt'],str) or extraction_reward(row['answer'],row['ground_truth_json'])!=1:raise ValueError('RLVR format/reward failed')
    for row in dpo:
        if not all(isinstance(row.get(k),str) and row[k].strip() for k in ('prompt','chosen','rejected')) or row['chosen']==row['rejected'] or not no_guarantee(row['chosen']):raise ValueError('Invalid DPO pair')
    return {'status':'PASSED','scope':'CPU dataset/hash/config/reward function checks only','synthetic_examples':manifest['accepted'],'rlvr_records':len(rlvr),'dpo_pairs':len(dpo),'max_steps':1,'schema_algorithm':'drgrpo','empathy_algorithm':'dpo','shared_lora':{'rank':32,'alpha':64,'modules':TARGET_MODULES},'versions':package_versions(),'live_reward_registration':'BLOCKED until AlignTune installed; CPU contract mock is covered by unit tests','checkpoint_saving':'BLOCKED for real training; fixture trainer and manifest tamper tests execute in unit suite','training_started':False,'model_evaluated':False}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--data',type=Path,default=ROOT/'artifacts/smoke-test/data');a=p.parse_args();report=verify(a.data)
    dest=ROOT/'artifacts/smoke-test/preflight.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
