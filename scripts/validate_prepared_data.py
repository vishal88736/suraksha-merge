"""Validate real prepared artifacts without starting training or model evaluation."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from research.common import ROOT,read_jsonl,schema_valid,payload_matches,no_guarantee,required_rails,engine_batch,strict_json
from research.artifacts import safe_dataset_file
from research.dataset_quality import assert_split_isolation,assert_public_numeric_grounding,fingerprint
from phase2_aligntune_train_and_merge import check_data


def validate(output,benchmarks):
    output,benchmarks=Path(output),Path(benchmarks)
    manifest=strict_json((output/'manifest.json').read_text())
    for name,expected in manifest['files'].items():
        path=safe_dataset_file(output,name)
        if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise ValueError('Prepared artifact checksum mismatch: '+name)
    rows=read_jsonl(output/'unified.jsonl')
    if not rows or len({r['sample_id'] for r in rows})!=len(rows):raise ValueError('Missing or duplicate unified IDs')
    if not all(schema_valid(r['target']) for r in rows):raise ValueError('Invalid eight-field target')
    isolation=assert_split_isolation(rows)
    grounded=assert_public_numeric_grounding(rows)
    for row in rows:
        if any('\ufffd' in (text or '') for text in (row['input']['message'],row['chosen_reply'],row.get('rejected_reply'))):
            raise ValueError('Prepared multilingual text contains a Unicode replacement character')
        if row['human_reviewed'] and not row['provenance'].get('review_reference'):raise ValueError('Unproven human review')
        if row['origin']=='public_source' and row['source_provenance']['role']!='training_candidates':raise ValueError('Benchmark source in training corpus')
    bm=strict_json((benchmarks/'manifest.json').read_text())
    if hashlib.sha256((benchmarks/'records.jsonl').read_bytes()).hexdigest()!=bm['records_sha256']:raise ValueError('Benchmark artifact modified')
    reserved=read_jsonl(benchmarks/'records.jsonl')
    blocked={fingerprint(r['input']['message']) for r in reserved}
    if any(fingerprint(r['input']['message']) in blocked for r in rows):raise ValueError('Exact external benchmark overlap')
    sizes={}
    for split in ('train','validation','test'):
        subset={r['sample_id']:r for r in rows if r['split']==split}
        rlvr=read_jsonl(output/split/'rlvr.jsonl');dpo=read_jsonl(output/split/'dpo.jsonl');sft=read_jsonl(output/split/'sft.jsonl')
        if len(rlvr)!=len(subset) or len(sft)!=2*len(subset):raise ValueError('Task export counts disagree with accepted examples')
        if {r['provenance']['sample_id'] for r in rlvr}!=set(subset):raise ValueError('RLVR sample alignment failed')
        for row in rlvr:
            target=subset[row['provenance']['sample_id']]['target']
            if not payload_matches(strict_json(row['answer']),target) or not payload_matches(row['ground_truth_json'],target):raise ValueError('RLVR target changed')
        for row in dpo:
            target=subset[row['provenance']['sample_id']]['target']
            if row['chosen']==row['rejected'] or not no_guarantee(row['chosen']) or no_guarantee(row['rejected']) or not required_rails(row['chosen'],target):raise ValueError('Invalid policy preference pair')
            if not row['prompt'].startswith('Return only an empathetic'):raise ValueError('DPO pair does not use the reply task')
        sizes[split]={'examples':len(subset),'rlvr':len(rlvr),'dpo':len(dpo),'sft':len(sft),'uncurated_sft':len(read_jsonl(output/split/'uncurated_sft.jsonl'))}
    # This executes the existing masking implementation only; it is not a model
    # benchmark and is not used to manufacture target annotations.
    mask_traces=engine_batch([r['input'] for r in rows])
    if any(t['privacy']['sanitized']!=r['input']['message'] for r,t in zip(rows,mask_traces,strict=True)):raise ValueError('Prepared input still contains a supported unmasked PII pattern')
    default_blocked=False
    try:check_data(SimpleNamespace(data=output,allow_bootstrap_data=False))
    except ValueError as error:
        if 'unreviewed' not in str(error):raise
        default_blocked=True
    check_data(SimpleNamespace(data=output,allow_bootstrap_data=True))
    return {'checks':'passed','accepted':len(rows),'files_verified':len(manifest['files']),
        'task_sizes':sizes,'isolation':isolation,'grounding':grounded,'masking_idempotence_rows_checked':len(rows),
        'external_benchmark_records':len(reserved),'external_exact_overlap':0,'default_training_blocked_for_review':default_blocked,
        'explicit_smoke_configuration_validated':True,'training_started':False,'model_benchmark_started':False}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'data/processed/upi-v1')
    parser.add_argument('--benchmarks',type=Path,default=ROOT/'data/benchmarks_external/upi-v1')
    parser.add_argument('--report',type=Path,default=ROOT/'artifacts/public-data-validation.json')
    args=parser.parse_args();report=validate(args.output,args.benchmarks)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
