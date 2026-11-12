"""Acquire-aware preparation that extends the existing phase-one curation path."""
from __future__ import annotations
from collections import Counter,defaultdict
import hashlib
import json
import re
from pathlib import Path
from research.common import ROOT,digest,engine_batch,read_jsonl,write_jsonl
from research.data_sources import load_registry,verified_downloads,iter_source_rows,save_json
from research.dataset_quality import UPI,LOSS,EXCLUDE,language_of,public_target,fingerprint,assert_split_isolation,assert_public_numeric_grounding
from research.synthetic_upi import generate_synthetic,negative_reply


def source_provenance(source,download,row,index):
    return {'source_id':source['id'],'revision':source['revision'],'source_path':download['source_path'],
        'row_id':str(row.get('id',index)),'license':source['license'],'original_sha256':digest(row),
        'download_sha256':download['sha256'],'attribution_url':source['attribution_url'],'role':source['role'],
        'source_split':row.get('split',Path(download['source_path']).stem),
        'source_label':row.get('label'),'grouping_policy':'all unlinked public templates of the same source/category co-grouped conservatively','our_review_status':'not_human_reviewed'}


def benchmark_text(row,source_id):
    if source_id=='indicjevbench':return row.get('state','')
    return '\n'.join(str(step.get('text','')) for step in row.get('attack_sequence',[]) if step.get('text'))


def inspect_and_select(raw_root,output,benchmarks):
    registry={s['id']:s for s in load_registry()['sources']}
    candidates=[];heldout=[];rejected=[];inspections=[]
    for download,path in verified_downloads(raw_root):
        source=registry[download['source_id']];counts=Counter();columns=set();labels=Counter();max_chars=0
        for index,row in enumerate(iter_source_rows(path,source['format']),1):
            counts['rows']+=1;columns.update(row)
            prov=source_provenance(source,download,row,index)
            if not set(source['columns']).issubset(row):
                counts['invalid_columns']+=1;rejected.append({'source_provenance':prov,'reason':'missing_source_columns'});continue
            if 'label' in row:labels[str(row['label'])]+=1
            if source['role']=='evaluation_only':
                message=benchmark_text(row,source['id'])
                if not message.strip():
                    counts['empty_benchmark_text']+=1;rejected.append({'source_provenance':prov,'reason':'empty_benchmark_text'});continue
                if len(message.encode('utf-16-le'))//2>12000:
                    counts['benchmark_text_oversized']+=1;rejected.append({'source_provenance':prov,'reason':'benchmark_text_oversized'});continue
                source_target={'question':row['question'],'expected':row['expected']} if source['id']=='indicjevbench' else {'ground_truth':{k:row['ground_truth'][k] for k in ('is_scam','category','difficulty') if k in row['ground_truth']}}
                heldout.append({'sample_id':f"external:{source['id']}:{digest([download['source_path'],index])[:18]}",
                    'source_provenance':prov,'input':{'message':message},'source_target':source_target,
                    'source_language':row.get('lang',row.get('metadata',{}).get('language')),
                    'origin':'public_source','synthetic_status':'published_reconstructed_benchmark' if source['id']=='chakravyuh_bench' else 'mixed_translated_derived_and_synthetic_tasks','usage':'evaluation_only','triage_target_status':'unavailable_original_task_only','human_reviewed':False})
                counts['heldout']+=1;continue
            message=row.get('text','')
            if source['id']=='cucom':
                message=next((t.get('content','') for t in row.get('turns',[]) if t.get('role')=='user'),'')
            if not isinstance(message,str):message=''
            max_chars=max(max_chars,len(message));reason=None
            if source['id']=='scam_ham_india' and not re.search(r'\b(?:I\s+(?:was|have|made|sent|paid|lost|noticed|did)|my\s+(?:upi|account|payment|money|transaction))\b',message,re.I):reason='sms_is_not_a_customer_dispute_report'
            elif source['role']=='auxiliary_only':reason='banking_intent_is_not_upi_dispute_gold'
            elif not UPI.search(message):reason='no_explicit_upi_channel'
            elif EXCLUDE.search(message):reason='promotion_fee_or_non_dispute_context'
            elif not LOSS.search(message):reason='no_customer_payment_dispute_evidence'
            elif not message.strip() or len(message.encode('utf-16-le'))//2>12000:reason='empty_or_oversized_message'
            if reason:
                counts['excluded']+=1;rejected.append({'source_provenance':prov,'reason':reason});continue
            language=language_of(message)
            target=public_target(message,language)
            candidates.append({'sample_id':f"public:{source['id']}:{digest([download['source_path'],index])[:18]}",
                'scenario_group':f"public:{source['id']}:unlinked-templates:{target['dispute_category']}",'split':'train',
                'origin':'public_source','synthetic_status':'source_declares_synthetic_conversation' if source['id']=='cucom' else 'mixed_real_synthetic_unresolved_per_record',
                'human_reviewed':False,'label_status':'programmatic_silver_unreviewed','input':{'message':message,'language':language},
                'target':target,'rejected_reply':negative_reply(language),
                'negative_origin':'synthetic_unsafe_guarantee','source_provenance':prov,'usage':'development'})
            counts['training_candidates']+=1
        inspections.append({'source_id':source['id'],'source_path':download['source_path'],'format':source['format'],
            'columns':sorted(columns),'counts':dict(counts),'label_counts':dict(labels),'maximum_message_characters':max_chars,
            'license':source['license'],'sha256':download['sha256'],'revision':source['revision'],'role':source['role']})
    # External source gold remains in its original task, with no invented UTR,
    # amount, liability tier or transfer authorization labels.
    traces=engine_batch([r['input'] for r in heldout])
    for row,trace in zip(heldout,traces,strict=True):row['input']['message']=trace['privacy']['sanitized']
    write_jsonl(Path(benchmarks)/'records.jsonl',heldout)
    write_jsonl(Path(output)/'source_selection_rejected.jsonl',rejected)
    save_json(Path(output)/'source_inspection.json',{'files':inspections})
    save_json(Path(benchmarks)/'manifest.json',{'source_files':[r for r in inspections if r['role']=='evaluation_only'],
        'records':len(heldout),'source_counts':dict(Counter(r['source_provenance']['source_id'] for r in heldout)),
        'records_sha256':hashlib.sha256((Path(benchmarks)/'records.jsonl').read_bytes()).hexdigest(),
        'training_allowed':False,'model_benchmark_executed':False,'eight_field_gold_available':False})
    return candidates,heldout,inspections,rejected


def prepare(raw_root,output,benchmarks,*,include_synthetic=True):
    from phase1_curatorkit_pipeline import curate
    output,benchmarks=Path(output),Path(benchmarks)
    candidates,heldout,inspections,selection_rejected=inspect_and_select(raw_root,output,benchmarks)
    blocked={fingerprint(r['input']['message']) for r in heldout}
    # Retain the old test seeds as separate regression fixtures, never recycle
    # them into the new train/validation corpus.
    legacy=[r for r in read_jsonl(ROOT/'data/seeds/synthetic_cases.jsonl') if r['split']=='test']
    blocked.update(fingerprint(r['input']['message']) for r in legacy)
    if include_synthetic:candidates+=generate_synthetic()
    # All new annotation authorship is explicit. The engine only checks the
    # independently specified or silver targets for consistency downstream.
    manifest=curate(candidates,output,use_curatorkit=True,grouped_split=True,blocked_fingerprints=blocked)
    unified=read_jsonl(output/'unified.jsonl')
    isolation=assert_split_isolation(unified)
    if any(fingerprint(r['input']['message']) in blocked for r in unified):raise ValueError('Independent benchmark contamination')
    categories=Counter(r['target']['dispute_category'] for r in unified)
    languages=Counter(r['target']['detected_language'] for r in unified)
    source_counts=Counter(r.get('source_provenance',{}).get('source_id','local_synthetic') if r.get('source_provenance') else 'local_synthetic' for r in unified)
    split_counts=Counter(r['split'] for r in unified)
    details={}
    for split in ('train','validation','test'):
        selected=[r for r in unified if r['split']==split]
        details[split]={'records':len(selected),'categories':dict(Counter(r['target']['dispute_category'] for r in selected)),
            'languages':dict(Counter(r['target']['detected_language'] for r in selected)),'families':len({r['scenario_group'] for r in selected})}
    rejected=read_jsonl(output/'rejected.jsonl')
    reasons=Counter(str(reason) for r in rejected for reason in (r.get('reason',[]) if isinstance(r.get('reason'),list) else [r.get('reason')]))
    report={'source_row_counts':dict(Counter({s:sum(r['counts']['rows'] for r in inspections if r['source_id']==s) for s in {i['source_id'] for i in inspections}})),
        'raw_download_bytes':sum(r['bytes'] for r,_ in verified_downloads(raw_root)),
        'source_selection_rejections':len(selection_rejected),'curation_candidates':len(candidates),
        'curation_rejected':len(rejected),'curation_rejection_reasons':dict(reasons),'accepted':len(unified),
        'category_counts':dict(categories),'language_counts':dict(languages),'source_counts':dict(source_counts),
        'origin_counts':dict(Counter(r['origin'] for r in unified)),'label_status_counts':dict(Counter(r['label_status'] for r in unified)),
        'human_reviewed':sum(r['human_reviewed'] for r in unified),'split_counts':dict(split_counts),
        'split_percentages':{s:round(100*n/len(unified),2) for s,n in split_counts.items()} if unified else {},'by_split':details,
        'independent_benchmark_records':len(heldout),'legacy_test_seeds_reserved':len(legacy),
        'quality_checks':{**isolation,'external_benchmark_exact_overlap':0,'full_schema_validated':all(__import__('research.common',fromlist=['schema_valid']).schema_valid(r['target']) for r in unified),**assert_public_numeric_grounding(unified)},
        'curatorkit_operations':manifest['curatorkit_operations'],
        'training_ready':{'format_compatible':bool(unified),'target_tokenizer_lengths_verified':False,'production_or_quality_study':False,'default_training_gate':'blocked_unreviewed_dataset',
            'reason':'Programmatic silver labels and authored synthetic specifications have not had independent human review.'},
        'remaining_issues':['No newly generated or mapped record is human-reviewed.','CuCom is publicly sourced synthetic dialogue, not operational customer truth.',
            'Chosen replies use the existing policy templates and need regional-language review.','DPO negatives are explicitly synthetic unsafe-guarantee mutations, not human preference ratings.',
            'CuratorKIT minhash plus family grouping and exact benchmark exclusion are not a semantic leakage guarantee.',
            'Contextual regex masking is executed; Presidio NLP and comprehensive name/address detection are not executed.',
            'Unsupported or engine-inconsistent source mappings are quarantined, not relabelled from the engine.',
            'Model-specific token lengths are not measured; no model or tokenizer was downloaded for training.',
            'Independent public benchmarks retain their original task labels; no eight-field expert gold or model scores were fabricated.']}
    code_files=['phase1_curatorkit_pipeline.py','research/data_sources.py','research/curator_bridge.py','research/dataset_quality.py','research/synthetic_upi.py','research/prepare_dataset.py','scripts/prepare_public_data.py','scripts/triage.mjs','research/common.py','lib/engine.ts','lib/rules/classification.ts','lib/rules/language.ts','lib/numbers.ts','lib/i18n/replies.ts','data/triage.schema.json','lib/policy.ts']
    manifest.update(source_registry_sha256=hashlib.sha256((ROOT/'data/public_sources.lock.json').read_bytes()).hexdigest(),
        code_file_sha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in code_files},
        public_sources=[{k:s[k] for k in ('id','repository','revision','license','role','attribution_url')} for s in load_registry()['sources']],
        distributions={k:report[k] for k in ('category_counts','language_counts','source_counts','split_counts','origin_counts','label_status_counts')},
        training_readiness=report['training_ready'],quality_checks=report['quality_checks'])
    for name in ('source_selection_rejected.jsonl','source_inspection.json'):
        manifest['files'][name]=hashlib.sha256((output/name).read_bytes()).hexdigest()
    save_json(output/'quality_report.json',report)
    manifest['files']['quality_report.json']=hashlib.sha256((output/'quality_report.json').read_bytes()).hexdigest()
    save_json(output/'manifest.json',manifest)
    (output/'dataset_card.md').write_text('# Suraksha public source and synthetic UPI corpus\n\nProgrammatic silver annotations and authored synthetic scenarios, with zero assumed human review. Original downloads are separate and revision-pinned. The rule engine is a consistency gate, not independently verified ground truth. Public benchmarks are excluded from training and retain their original labels. All counts, distributions, toolkit stage results, licenses and readiness limitations are recorded in quality_report.json and manifest.json.\n')
    return report
