"""Human-authored review decisions. Generated records remain pending by default."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
from research.common import ROOT, read_jsonl, schema_valid, write_jsonl, digest, no_guarantee, required_rails

CATEGORIES = ("P2M_CONFIRMATION_FAILURE", "P2P_BENEFICIARY_NOT_CREDITED", "COLLECT_REQUEST_SCAM", "REMOTE_ACCESS_SCAM", "VOLUNTARY_WRONG_VPA_TRANSFER", "UNAUTHORIZED_ACCOUNT_TAKEOVER", "NEEDS_INFORMATION")
LANGUAGES = ("english", "hindi_devanagari", "hinglish", "tanglish", "marathi_english")
FIELDS = ("classification", "json_ground_truth", "language_quality", "rbi_policy_guidance", "dpo_preference")

def build_queue(dataset, output, *, split=None, review_type="annotation"):
    rows=read_jsonl(Path(dataset)/"unified.jsonl")
    if split: rows=[r for r in rows if r["split"]==split]
    queue=[]
    for row in rows:
        p=row["provenance"]; target=row["target"]
        risk=0; reasons=[]
        if target["dispute_category"] in {"COLLECT_REQUEST_SCAM","REMOTE_ACCESS_SCAM","UNAUTHORIZED_ACCOUNT_TAKEOVER"}: risk+=4; reasons.append("fraud_policy_risk")
        if target["rbi_liability_tier"] in {"ZERO_LIABILITY_ELIGIBLE","LIMITED_LIABILITY_ELIGIBLE","CUSTOMER_NEGLIGENCE_REVIEW","BANK_POLICY_REVIEW"}: risk+=3; reasons.append("liability_classification")
        if target["dispute_category"]=="NEEDS_INFORMATION": risk+=2; reasons.append("ambiguous_or_incomplete_evidence")
        if target["utr_number"] or target["amount_inr"] is not None: risk+=1; reasons.append("numeric_transaction_fact")
        if p.get("source_provenance"): risk+=2; reasons.append("public_source_silver_label")
        if p.get("label_status")=="synthetic_specification_unreviewed": reasons.append("synthetic_specification")
        queue.append({"review_id":row["sample_id"],"scenario_group":row["scenario_group"],"split":row["split"],"origin":row["origin"],"review_type":review_type,"priority":risk,"priority_reasons":reasons,"input":row["input"],"complaint_text":row["input"]["message"],"expected_json":target,"chosen_reply":row["chosen_reply"],"rejected_reply":row.get("rejected_reply"),"provenance":p,"review_status":"pending","required_reviews":list(FIELDS),"decisions":[]})
    cats={r["expected_json"]["dispute_category"] for r in queue}; langs={r["expected_json"]["detected_language"] for r in queue}
    if review_type=="annotation" and queue and (set(CATEGORIES)-cats or set(LANGUAGES)-langs): raise ValueError("Review queue lacks required category or language coverage")
    queue.sort(key=lambda r:(-r["priority"],r["review_id"]))
    if Path(output).exists() and read_jsonl(output)!=queue:
        raise ValueError("Queue already exists with different content; choose a new version")
    write_jsonl(output,queue)
    return {"records":len(queue),"pending":len(queue),"human_reviewed":0,"categories":len(cats),"languages":len(langs),"review_type":review_type}

def validate_annotation(row):
    target=row['expected_json']
    if not schema_valid(target): raise ValueError('Corrected target violates eight-field schema')
    if target['utr_number'] and target['utr_number'] not in row['complaint_text']: raise ValueError('UTR absent from complaint')
    if not isinstance(row['chosen_reply'],str) or not row['chosen_reply'].strip(): raise ValueError('Chosen reply required')
    if not no_guarantee(row['chosen_reply']) or not required_rails(row['chosen_reply'],target): raise ValueError('Chosen reply fails policy pattern/rail checks')
    if not isinstance(row.get('rejected_reply'),str) or not row['rejected_reply'].strip() or row['chosen_reply']==row['rejected_reply']: raise ValueError('Distinct DPO replies required')

def decision_row(item, decision):
    import copy
    row=copy.deepcopy(item)
    row.update(decision.get('corrections',{}))
    validate_annotation(row)
    return row

def record_decision(queue_path, decisions_path, review_id, reviewer, action, *, corrections=None, fields=None, notes='', attest=False):
    import fcntl
    if not attest or not reviewer or not reviewer.strip(): raise ValueError('Named human reviewer and explicit human attestation required')
    if action not in {'accept','reject','correct','reopen'}: raise ValueError('Invalid review action')
    item=next((r for r in read_jsonl(queue_path) if r['review_id']==review_id),None)
    if item is None: raise ValueError('Unknown review id')
    corrections=corrections or {}; fields=[] if fields is None else fields
    if set(fields)!=set(FIELDS) and action in {'accept','correct'}: raise ValueError('All five review dimensions must be explicitly confirmed')
    if corrections and action!='correct': raise ValueError('Corrections require the correct action')
    if action=='correct' and not corrections: raise ValueError('Provide corrections')
    if set(corrections)-{'expected_json','chosen_reply','rejected_reply'}: raise ValueError('Unsupported correction field')
    decision={'review_id':review_id,'reviewer':reviewer.strip(),'timestamp_utc':datetime.now(timezone.utc).isoformat(),'action':action,'fields':fields,'corrections':corrections,'notes':notes,'human_attestation':True,'item_sha256':digest(item)}
    path=Path(decisions_path);path.parent.mkdir(parents=True,exist_ok=True)
    # Lock the complete atomic read-modify-write to prevent concurrent lost decisions.
    with (path.with_suffix('.lock')).open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        decisions=read_jsonl(path) if path.exists() else []
        cumulative={}
        for old in decisions:
            if old['review_id']==review_id: cumulative.update(old.get('corrections',{}))
        cumulative.update(corrections)
        if action in {'accept','correct'}:
            decision['corrections']=cumulative
            decision_row(item,decision)
        decision['previous_decision_sha256']=digest(decisions[-1]) if decisions else None
        decisions.append(decision);write_jsonl(path,decisions)
    return decision

def materialize_reviewed(queue_path, decisions_path, output):
    queue={r['review_id']:r for r in read_jsonl(queue_path)}
    decisions=read_jsonl(decisions_path) if Path(decisions_path).exists() else []
    history={};previous=None
    for d in decisions:
        if d['review_id'] not in queue or d.get('item_sha256')!=digest(queue[d['review_id']]) or d.get('previous_decision_sha256')!=previous or not d.get('human_attestation') or not d.get('reviewer') or not d.get('timestamp_utc'): raise ValueError('Review history/provenance invalid')
        datetime.fromisoformat(d['timestamp_utc'])
        if d['action'] not in {'accept','correct','reject','reopen'}: raise ValueError('Invalid decision')
        if d['action'] in {'accept','correct'} and set(d['fields'])!=set(FIELDS): raise ValueError('Incomplete human review')
        history.setdefault(d['review_id'],[]).append(d);previous=digest(d)
    outputs={'reviewed':[],'rejected':[],'unreviewed':[]}
    for rid,item in queue.items():
        h=history.get(rid,[]);d=h[-1] if h else None
        bucket='unreviewed' if d is None or d['action']=='reopen' else 'rejected' if d['action']=='reject' else 'reviewed'
        cumulative={}
        for entry in h: cumulative.update(entry.get('corrections',{}))
        row=decision_row(item,{'corrections':cumulative}) if bucket=='reviewed' else {**item,**cumulative}
        row.update(review_history=h,human_reviewed=bucket=='reviewed',review_status='human_reviewed' if bucket=='reviewed' else 'rejected' if bucket=='rejected' else 'pending')
        outputs[bucket].append(row)
    for key,rows in outputs.items(): write_jsonl(Path(output)/(key+'.jsonl'),rows)
    return {key:len(value) for key,value in outputs.items()}

def prepare_evaluation(dataset, output):
    from research.dataset_quality import coalesce_families,assert_split_isolation
    import copy
    rows=read_jsonl(Path(dataset)/'unified.jsonl')
    checked=copy.deepcopy(rows);coalesce_families(checked,threshold=.85);assert_split_isolation(checked)
    report=build_queue(dataset,Path(output)/'candidates.jsonl',split='test',review_type='independent_evaluation')
    candidates=read_jsonl(Path(output)/'candidates.jsonl')
    if {r['expected_json']['dispute_category'] for r in candidates}!=set(CATEGORIES) or {r['expected_json']['detected_language'] for r in candidates}!=set(LANGUAGES): raise ValueError('Evaluation coverage incomplete')
    manifest={'candidate_count':len(candidates),'human_reviewed':0,'status':'PENDING_HUMAN_REVIEW','training_allowed':False,'selection_allowed':False,'source_unified_sha256':digest((Path(dataset)/'unified.jsonl').read_bytes()),'candidates_sha256':digest((Path(output)/'candidates.jsonl').read_bytes()),'near_duplicate_jaccard_threshold':.85,'family_and_near_duplicate_overlap':0,'limitation':'Existing synthetic test split; no independent empirical gold until separate human review.'}
    (Path(output)/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return report

def finalize_evaluation(queue, decisions, output, annotation_decisions=None):
    if (Path(output)/'evaluation.jsonl').exists(): raise ValueError('Evaluation release already exists; choose a new immutable release directory')
    materialize_reviewed(queue,decisions,output)
    pending=read_jsonl(Path(output)/'unreviewed.jsonl');reviewed=read_jsonl(Path(output)/'reviewed.jsonl')
    if pending or not reviewed: raise ValueError('Evaluation is pending human review')
    authors={}
    if annotation_decisions and Path(annotation_decisions).exists():
        for d in read_jsonl(annotation_decisions): authors.setdefault(d['review_id'],set()).add(d['reviewer'])
    for row in reviewed:
        if row['review_history'][-1]['reviewer'] in authors.get(row['review_id'],set()): raise ValueError('Evaluation reviewer must be independent of annotation reviewer')
    if {r['expected_json']['dispute_category'] for r in reviewed}!=set(CATEGORIES) or {r['expected_json']['detected_language'] for r in reviewed}!=set(LANGUAGES): raise ValueError('Reviewed evaluation coverage incomplete')
    write_jsonl(Path(output)/'evaluation.jsonl',reviewed)
    (Path(output)/'release_manifest.json').write_text(json.dumps({'status':'HUMAN_REVIEWED','reviewed':len(reviewed),'queue_sha256':digest(Path(queue).read_bytes()),'decisions_sha256':digest(Path(decisions).read_bytes()),'evaluation_sha256':digest((Path(output)/'evaluation.jsonl').read_bytes()),'model_evaluated':False},indent=2)+'\n')
    return {'reviewed':len(reviewed),'status':'HUMAN_REVIEWED','model_evaluated':False}

def export_curation(queue, decisions, output, languages=None):
    """languages: an explicit subset whose review is complete (recorded in the result); default all."""
    languages=tuple(languages or LANGUAGES)
    if not set(languages)<=set(LANGUAGES): raise ValueError(f'Unknown languages: {sorted(set(languages)-set(LANGUAGES))}')
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        materialize_reviewed(queue,decisions,tmp)
        reviewed=read_jsonl(Path(tmp)/'reviewed.jsonl')
    rows=[]
    for row in reviewed:
        if row['split']=='test': continue  # Held-out evaluation never promoted to training.
        if row['expected_json']['detected_language'] not in languages: continue
        decision=row['review_history'][-1]
        rows.append({'sample_id':row['review_id'],'scenario_group':row['scenario_group'],'split':row['split'],'origin':row['origin'],'input':row['input'],'target':row['expected_json'],'chosen_reply':row['chosen_reply'],'rejected_reply':row['rejected_reply'],'source_provenance':row['provenance'].get('source_provenance'),'human_reviewed':True,'review_reference':{'reviewer':decision['reviewer'],'timestamp_utc':decision['timestamp_utc'],'decision_sha256':digest(decision)},'label_status':'human_reviewed_annotation'})
    if {r['split'] for r in rows}!={'train','validation'}: raise ValueError('Reviewed train and validation records required')
    if {r['target']['dispute_category'] for r in rows}!=set(CATEGORIES) or {r['target']['detected_language'] for r in rows}!=set(languages): raise ValueError('Reviewed training coverage incomplete')
    write_jsonl(output,rows)
    return {'reviewed_curation_inputs':len(rows),'heldout_test_excluded':True,'languages':list(languages),'languages_excluded':sorted(set(LANGUAGES)-set(languages)),'next_step':'Run existing phase1 curation gates on this input; inspect rejected corrections.'}

def main():
    import argparse
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='cmd',required=True)
    for cmd in ('build','evaluation'):
        b=sub.add_parser(cmd);b.add_argument('--data',type=Path,default=ROOT/'data/processed/upi-v1');b.add_argument('--output',type=Path,default=ROOT/('data/review/annotation_queue.jsonl' if cmd=='build' else 'data/review/evaluation'))
    for cmd in ('show','decide','export','finalize-evaluation','export-curation'):
        d=sub.add_parser(cmd);d.add_argument('--queue',type=Path,default=ROOT/'data/review/annotation_queue.jsonl');d.add_argument('--decisions',type=Path,default=ROOT/'data/review/decisions.jsonl')
        if cmd in ('show','decide'): d.add_argument('review_id')
        if cmd=='export-curation': d.add_argument('--languages',nargs='+',choices=sorted(LANGUAGES),help='export only these languages (their review must be complete)')
        if cmd=='decide':
            d.add_argument('--reviewer',required=True);d.add_argument('--action',choices=['accept','reject','correct','reopen'],required=True);d.add_argument('--corrections',type=Path);d.add_argument('--notes',default='');d.add_argument('--attest-human-review',action='store_true');d.add_argument('--confirmed-fields',nargs='+',default=[])
        if cmd in ('export','finalize-evaluation','export-curation'): d.add_argument('--output',type=Path,required=True)
        if cmd=='finalize-evaluation': d.add_argument('--annotation-decisions',type=Path,default=ROOT/'data/review/decisions.jsonl')
    a=p.parse_args()
    if a.cmd=='build': result=build_queue(a.data,a.output)
    elif a.cmd=='evaluation': result=prepare_evaluation(a.data,a.output)
    elif a.cmd=='show':
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            materialize_reviewed(a.queue,a.decisions,tmp)
            result=next((r for name in ('reviewed','rejected','unreviewed') for r in read_jsonl(Path(tmp)/(name+'.jsonl')) if r['review_id']==a.review_id),None)
        if result is None:
            raise SystemExit(f"Unknown review id {a.review_id!r}. IDs look like 'syn-2-0-4-1'; list them with: .venv/bin/python -I -c \"import json;[print(json.loads(l)['review_id']) for l in open('data/review/annotation_queue.jsonl')]\"")
    elif a.cmd=='decide': result=record_decision(a.queue,a.decisions,a.review_id,a.reviewer,a.action,corrections=json.loads(a.corrections.read_text()) if a.corrections else None,fields=a.confirmed_fields,notes=a.notes,attest=a.attest_human_review)
    elif a.cmd=='export-curation': result=export_curation(a.queue,a.decisions,a.output,a.languages)
    elif a.cmd=='export': result=materialize_reviewed(a.queue,a.decisions,a.output)
    else: result=finalize_evaluation(a.queue,a.decisions,a.output,a.annotation_decisions)
    print(json.dumps(result,indent=2,ensure_ascii=False))
if __name__=='__main__':main()
