"""CPU-safe environment report. Metadata/network and local weight checks are opt-in."""
import argparse, importlib.metadata as md, inspect as inspection, json, shutil, subprocess, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from phase2_aligntune_train_and_merge import BASE_MODEL,TARGET_MODULES,assert_tokenizer_matches_model
from research.common import ROOT,read_jsonl,digest

def verify_metadata(config,tokenizer):
    ids=[v for v in tokenizer['model']['vocab'].values()]+[x['id'] for x in tokenizer.get('added_tokens',[])]
    if not ids or min(ids)<0 or max(ids)>=config['vocab_size']: raise ValueError('Tokenizer IDs exceed configured embedding dimensions')
    return {'status':'PASSED','scope':'published config/tokenizer IDs; weight tensors not loaded','max_token_id':max(ids),'embedding_rows_configured':config['vocab_size'],'padded_vocab_allowed':True}

def inspect(model_dir=None,fetch=False,load_weights=False,data=None):
    packages={}
    for name in ('torch','transformers','tokenizers','aligntune','peft','trl','safetensors','accelerate','bitsandbytes'):
        try: packages[name]=md.version(name)
        except md.PackageNotFoundError: packages[name]=None
    result={'base_model':BASE_MODEL,'packages':packages,'dependencies_status':'PASSED' if all(packages[n] for n in ('torch','transformers','aligntune','peft','trl','safetensors','accelerate')) else 'BLOCKED','cuda':{'status':'BLOCKED','reason':'PyTorch/CUDA not available'},'embedding_weights':{'status':'BLOCKED','reason':'Explicit local weights check not requested'},'tokenizer':{'status':'BLOCKED','reason':'Model metadata unavailable'},'token_lengths':{'status':'BLOCKED','reason':'Tokenizer runtime/metadata unavailable'},'lora':{'status':'PASSED','scope':'shared static configuration','rank':32,'alpha':64,'modules':TARGET_MODULES},'aligntune_factory':{'status':'BLOCKED','reason':'AlignTune not installed/importable'}}
    try:
        import torch
        if torch.cuda.is_available():
            result['cuda']={'status':'PASSED','devices':[{'name':torch.cuda.get_device_name(i),'free_bytes':torch.cuda.mem_get_info(i)[0],'total_bytes':torch.cuda.mem_get_info(i)[1]} for i in range(torch.cuda.device_count())]}
        else: result['cuda']['reason']='PyTorch installed; CUDA unavailable'
    except (ImportError,RuntimeError,OSError) as e: result['cuda']['reason']=str(e)
    smi=shutil.which('nvidia-smi')
    if smi:
        p=subprocess.run([smi,'--query-gpu=name,memory.total,memory.free','--format=csv,noheader'],capture_output=True,text=True,timeout=10)
        result['driver']={'status':'PASSED' if p.returncode==0 else 'BLOCKED','details':p.stdout.strip() or p.stderr.strip()}
    else: result['driver']={'status':'BLOCKED','details':'nvidia-smi unavailable'}
    try:
        from aligntune.core.backend_factory import create_rl_trainer
        signature=str(inspection.signature(create_rl_trainer));result['aligntune_factory']={'status':'PASSED','scope':'import and signature only; trainer not instantiated','signature':signature}
        dist=md.distribution('aligntune');direct=json.loads(dist.read_text('direct_url.json') or '{}')
        expected=json.loads((ROOT/'research/toolkit_revisions.json').read_text())['aligntune']['revision']
        actual=direct.get('vcs_info',{}).get('commit_id')
        result['aligntune_revision']={'status':'PASSED' if actual==expected else 'FAILED','expected':expected,'actual':actual}
    except Exception as e: result['aligntune_factory']={'status':'BLOCKED','reason':type(e).__name__+': '+str(e)}
    directory=Path(model_dir) if model_dir else ROOT/'artifacts/training-preflight/qwen-tokenizer'
    if fetch:
        from research.data_sources import get_bytes,private_write
        try:
            lock=json.loads((ROOT/'research/qwen_model.lock.json').read_text());rev=lock['revision']
            for name in ('config.json','tokenizer.json','tokenizer_config.json'):
                payload=get_bytes(f'https://huggingface.co/{BASE_MODEL}/resolve/{rev}/{name}',32*1024*1024)
                if digest(payload)!=lock['metadata_sha256'][name]: raise ValueError('Pinned model metadata checksum mismatch')
                private_write(directory/name,payload)
            (directory/'revision.json').write_text(json.dumps({'repository':BASE_MODEL,'revision':rev})+'\n')
        except Exception as e: result['download']={'status':'BLOCKED','reason':str(e)}
    if (directory/'config.json').is_file() and (directory/'tokenizer.json').is_file():
        config=json.loads((directory/'config.json').read_text());tok=json.loads((directory/'tokenizer.json').read_text())
        try: result['tokenizer']=verify_metadata(config,tok)
        except ValueError as e: result['tokenizer']={'status':'FAILED','reason':str(e)}
        result['metadata_hashes']={n:digest((directory/n).read_bytes()) for n in ('config.json','tokenizer.json','tokenizer_config.json') if (directory/n).exists()}
        if (directory/'revision.json').exists(): result['model_revision']=json.loads((directory/'revision.json').read_text())
        try:
            from tokenizers import Tokenizer
            tokenizer=Tokenizer.from_file(str(directory/'tokenizer.json'));lengths=[];prompts=[];answers=[];dpo_lengths=[];sft_lengths=[]
            for split in ('train','validation','test'):
                for row in read_jsonl(Path(data or ROOT/'data/processed/upi-v1')/split/'rlvr.jsonl'):
                    lengths.append(len(tokenizer.encode(row['prompt']+'\n'+row['answer']).ids));prompts.append(len(tokenizer.encode(row['prompt']).ids));answers.append(len(tokenizer.encode(row['answer']).ids))
                for row in read_jsonl(Path(data or ROOT/'data/processed/upi-v1')/split/'dpo.jsonl'):
                    dpo_lengths.extend(len(tokenizer.encode(row['prompt']+'\n'+row[key]).ids) for key in ('chosen','rejected'))
                for row in read_jsonl(Path(data or ROOT/'data/processed/upi-v1')/split/'sft.jsonl'):
                    sft_lengths.append(len(tokenizer.encode(row['instruction']+'\n'+row['output']).ids))
            result['token_lengths']={'status':'PASSED','scope':'raw RLVR prompt+answer; trainer chat-template expansion still needs checking','records':len(lengths),'maximum':max(lengths),'over_2048':sum(n>2048 for n in lengths),'maximum_prompt':max(prompts),'maximum_answer':max(answers),'over_schema_prompt_budget_1536':sum(n>1536 for n in prompts),'over_completion_budget_512':sum(n>512 for n in answers),'maximum_dpo_pair_sequence':max(dpo_lengths),'dpo_sequences_over_2048':sum(n>2048 for n in dpo_lengths),'maximum_sft_sequence':max(sft_lengths),'sft_sequences_over_2048':sum(n>2048 for n in sft_lengths)}
        except ImportError: pass
        if load_weights:
            try:
                from transformers import AutoModelForCausalLM,AutoTokenizer
                model=AutoModelForCausalLM.from_pretrained(directory,local_files_only=True,trust_remote_code=False)
                tokenizer=AutoTokenizer.from_pretrained(directory,local_files_only=True,trust_remote_code=False)
                assert_tokenizer_matches_model(tokenizer,model);result['embedding_weights']={'status':'PASSED','scope':'actual local input/output embeddings'}
            except Exception as e: result['embedding_weights']={'status':'BLOCKED','reason':type(e).__name__+': '+str(e)}
    result['memory_estimate']={'status':'ESTIMATE_ONLY','assumption':'3.09B parameters, bf16 base, LoRA rank32, batch1, sequence2048; reference/rollout/activation/optimizer overhead varies','base_weights_gib':round(3.09e9*2/2**30,2),'drgrpo_planning_range_gib':[24,48],'dpo_planning_range_gib':[16,32],'hardware_fit':'BLOCKED until CUDA memory and actual allocation smoke run verified','quantization_enabled':False}
    if result.get('driver',{}).get('status')=='PASSED':
        totals=[float(line.split(',')[-2].strip().split()[0])/1024 for line in result['driver']['details'].splitlines()]
        result['memory_estimate']['observed_total_vram_gib']=totals
        if max(totals)<16: result['memory_estimate']['hardware_fit']='NOT_SUITABLE for current unquantized DR-GRPO/DPO planning configuration; CUDA allocations remain BLOCKED'
        else: result['memory_estimate']['hardware_fit']='UNVERIFIED: run CUDA allocation smoke on selected host'
    result['training_started']=False
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--model-dir',type=Path);p.add_argument('--fetch-tokenizer',action='store_true');p.add_argument('--load-local-weights',action='store_true');p.add_argument('--data',type=Path);p.add_argument('--report',type=Path,default=ROOT/'artifacts/training-preflight/environment.json');a=p.parse_args()
    result=inspect(a.model_dir,a.fetch_tokenizer,a.load_local_weights,a.data);a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':main()
