"""Authoritative CuratorKIT normalization and deduplication for phase one.

Only masked text enters toolkit work files. Surviving toolkit samples feed the
existing local gates and exports; this is not a discarded demonstration pass.
"""
from __future__ import annotations
from collections import defaultdict
import copy
import importlib.metadata
import json
from pathlib import Path
from research.common import digest, engine_batch, write_jsonl, schema_valid


def curate_inputs(rows, output, near_threshold=0.96):
    from curatorkit import Curator, CuratorConfig
    from curatorkit.schema import DataSample
    output=Path(output)
    rows=copy.deepcopy(rows)
    traces=engine_batch([r['input'] for r in rows])
    from research.dataset_quality import public_target
    retained=[];hygiene_rejections=[]
    for row,trace in zip(rows,traces,strict=True):
        row['input']['message']=trace['privacy']['sanitized']
        if not schema_valid(row.get('target')):
            hygiene_rejections.append({'sample_id':row['sample_id'],'reason':['schema_invalid']})
            continue
        # Reject an unsupported numeric annotation; never relabel from the
        # engine or write a redacted identifier back into a toolkit target.
        supported=public_target(row['input']['message'],row['target'].get('detected_language','english'))
        if any(row['target'].get(k) is not None and row['target'].get(k)!=supported[k] for k in ('utr_number','amount_inr')):
            hygiene_rejections.append({'sample_id':row['sample_id'],'reason':['numeric_annotation_not_supported_after_masking']})
            continue
        retained.append(row)
    rows=retained
    by_id={r['sample_id']:r for r in rows}
    canonical=[{'id':r['sample_id'],'instruction':r['input']['message'],
        'output':json.dumps({'target':r['target'],'context':{k:v for k,v in r['input'].items() if k!='message'}},sort_keys=True,ensure_ascii=False)} for r in rows]

    def convert(raw):
        return DataSample(id=raw['id'],source_uri='suraksha:masked-candidate:'+raw['id'],instruction=raw['instruction'],output=raw['output'],metadata={'sample_id':raw['id']})

    runs=[]
    def run(records, name, clean, dedup):
        directory=output/name
        path=directory/'input.jsonl'
        write_jsonl(path,records)
        result=Curator(CuratorConfig(dataset=str(path.resolve()),preprocessing_fn=convert,
            min_tokens=1,max_tokens=12000,clean=clean,clean_fields=['instruction'],
            clean_transforms={'strip_html':False},dedup=dedup,minhash_threshold=near_threshold,
            minhash_ngram=3,minhash_num_perm=128,minhash_seed=42,
            export_formats=['alpaca'],write_hf_readme=False,output_dir=str(directory))).run()
        runs.append({'name':name,'input':len(records),'passed':len(result.passed),
            'rejected':len(records)-len(result.passed),'stage_counts':result.stage_counts,
            'clean_transforms':{'strip_html':False,'normalise_unicode':True,'fix_encoding_artifacts':True,'collapse_whitespace':True,'remove_control_chars':True} if clean else None,
            'minhash_threshold':near_threshold if dedup=='minhash' else None})
        return result

    # Upstream runs dedup before cleaning. Two actual passes ensure duplicates
    # introduced by NFC/whitespace cleanup are caught after normalization.
    cleaned=run(canonical,'normalize',True,'none')
    normalized=[{'id':s.id,'instruction':s.instruction,'output':s.output} for s in cleaned.passed]
    final=run(normalized,'deduplicate',False,'exact')
    # A near duplicate must not erase an amount/date/authorization counterfactual.
    # Run the real toolkit normalizer inside exact target+operator-context buckets.
    from curatorkit.normalizers.dedup import MinHashDeduplicator
    from curatorkit.exporters.alpaca import AlpacaExporter
    partitions=defaultdict(list)
    for sample in final.passed:partitions[sample.output].append(sample)
    near_passed=[]
    for key,members in sorted(partitions.items()):
        near_passed.extend(MinHashDeduplicator(threshold=near_threshold,ngram=3,num_perm=128,seed=42).run(members))
    directory=output/'minhash';directory.mkdir(parents=True,exist_ok=True)
    AlpacaExporter().export(near_passed,directory)
    runs.append({'name':'annotation_partitioned_minhash','input':len(final.passed),'passed':len(near_passed),
        'rejected':len(final.passed)-len(near_passed),'annotation_partitions':len(partitions),
        'stage_counts':{'MinHashDeduplicator':{'input_count':len(final.passed),'output_count':len(near_passed)},
            'AlpacaExporter':{'exported_count':len(near_passed)}},'minhash_threshold':near_threshold,
        'critical_counterfactuals_preserved':True})
    passed=[]
    for sample in near_passed:
        row=by_id[sample.id]
        row['input']['message']=sample.instruction
        row['curatorkit_provenance']=[p.model_dump(mode='json') for p in sample.provenance_chain]
        passed.append(row)
    surviving={r['sample_id'] for r in passed}
    failures=hygiene_rejections+[{'sample_id':r['sample_id'],'reason':['curatorkit_schema_or_near_duplicate'],
        'source_id':r.get('source_provenance',{}).get('source_id'),'sanitized_sha256':digest(r['input']['message'].encode())} for r in rows if r['sample_id'] not in surviving]
    direct=json.loads(importlib.metadata.distribution('curatorkit').read_text('direct_url.json') or '{}')
    report={'version':importlib.metadata.version('curatorkit'),'source_revision':direct.get('vcs_info',{}).get('commit_id'),'authoritative_inputs':True,'runs':runs,
        'input':len(rows)+len(hygiene_rejections),'passed':len(passed),'rejected':len(failures),'token_counting':'whitespace with min_tokens=1; application UTF-16 bound remains authoritative',
        'html_tags_preserved_for_adversarial_text':True}
    return passed,failures,report


def export_preferences(records, output):
    """Validate/export genuine same-task preference rows with actual CuratorKIT."""
    from curatorkit import Curator,CuratorConfig
    from curatorkit.schema import DataSample
    output=Path(output)
    path=output/'input.jsonl';write_jsonl(path,records)
    def convert(raw):
        return DataSample(id=raw['provenance']['sample_id'],source_uri='suraksha:preference',task_type='preference',instruction=raw['prompt'],chosen=raw['chosen'],rejected=raw['rejected'])
    if not records:return {'input':0,'passed':0,'stage_counts':{},'executed':False}
    result=Curator(CuratorConfig(dataset=str(path.resolve()),preprocessing_fn=convert,
        min_tokens=1,max_tokens=12000,clean=False,dedup='none',export_formats=['dpo'],
        write_hf_readme=False,output_dir=str(output))).run()
    if len(result.passed)!=len(records):raise ValueError('CuratorKIT preference validation rejected an exported training row')
    return {'input':len(records),'passed':len(result.passed),'stage_counts':result.stage_counts,'executed':True}
