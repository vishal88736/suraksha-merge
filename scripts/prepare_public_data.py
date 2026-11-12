"""Audit and acquire pinned sources, then run the existing CuratorKIT pipeline."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from research.common import ROOT
from research.data_sources import audit_sources,download_sources


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',choices=['audit','download','prepare','all'],default='all')
    parser.add_argument('--raw',type=Path,default=ROOT/'data/raw')
    parser.add_argument('--output',type=Path,default=ROOT/'data/processed/upi-v1')
    parser.add_argument('--benchmarks',type=Path,default=ROOT/'data/benchmarks_external/upi-v1')
    args=parser.parse_args()
    if args.stage in ('audit','all'):
        result=audit_sources(args.raw)
        print(json.dumps({'stage':'audit','sources':[{k:r[k] for k in ['id','available','license_verified','role']} for r in result['sources']]},indent=2))
    if args.stage in ('download','all'):
        result=download_sources(args.raw)
        print(json.dumps({'stage':'download','files':len(result['files']),'bytes':sum(r['bytes'] for r in result['files'])},indent=2))

    if args.stage in ('prepare','all'):
        from research.prepare_dataset import prepare
        result=prepare(args.raw,args.output,args.benchmarks)
        print(json.dumps({key:result[key] for key in ['accepted','curation_rejected','category_counts','language_counts','source_counts','split_counts','human_reviewed','training_ready']},indent=2))

if __name__=='__main__':main()
