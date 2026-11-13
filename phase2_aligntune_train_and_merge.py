"""GPU training entry points using source-checked AlignTune APIs.

No model is downloaded in plan mode. Bootstrap data is explicitly gated.
"""
from __future__ import annotations
import argparse
import importlib.metadata
import json
from pathlib import Path
from research.common import ROOT, digest, extraction_reward, read_jsonl, write_jsonl
from research.artifacts import file_digest, read_adapter_manifest, write_adapter_manifest, resolve_adapter, safe_dataset_file

BASE_MODEL = "Qwen/Qwen2.5-3B-Instruct"
TARGET_MODULES = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
STAGES = ["plan", "adapt-tokenizer", "schema", "empathy", "curated-sft", "uncurated-sft", "merge"]
SEED = 42

def require_gpu(allow_cpu=False):
    import torch
    if not torch.cuda.is_available() and not allow_cpu:
        raise RuntimeError("A working CUDA GPU is required. Plan mode runs offline; --allow-cpu is only for deliberately small smoke runs.")
    return torch

def package_versions():
    out = {}
    for name in ("aligntune", "torch", "transformers", "peft", "trl", "safetensors"):
        try:
            out[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            out[name] = "not_installed"
    return out

def identity(model_name, revision=None):
    """Resolve the public Hub revision before loading config/tokenizer.

    Transformers 5 no longer retains config._commit_hash. A full requested SHA
    is already immutable; floating refs must be resolved through the Hub API.
    """
    import re
    from transformers import AutoConfig, AutoTokenizer
    model_path=Path(model_name)
    resolved_revision=None
    if not model_path.is_dir():
        if isinstance(revision,str) and re.fullmatch(r'[0-9a-fA-F]{40}',revision):
            resolved_revision=revision.lower()
        else:
            from huggingface_hub import HfApi
            resolved_revision=HfApi().model_info(repo_id=str(model_name),revision=revision or 'main').sha
            if not isinstance(resolved_revision,str) or not re.fullmatch(r'[0-9a-fA-F]{40}',resolved_revision):
                raise ValueError('Hub did not return an immutable model revision')
            resolved_revision=resolved_revision.lower()
    AutoConfig.from_pretrained(model_name,revision=resolved_revision,trust_remote_code=False)
    tok=AutoTokenizer.from_pretrained(model_name,revision=resolved_revision,trust_remote_code=False)
    weight_hashes={}
    if model_path.is_dir():
        weight_hashes=weight_digests(model_path)
        if not weight_hashes:
            raise ValueError('Local shared base has no model weights')
    return {'base_model':'local-checkpoint' if model_path.is_dir() else model_name,
        'base_revision':resolved_revision,'base_weights':weight_hashes,
        'tokenizer_sha256':digest(tok.get_vocab()),'tokenizer_size':len(tok),
        'target_modules':TARGET_MODULES,'rank':32,'alpha':64}

def weight_digests(directory):
    hashes={}
    for pattern in ('*.safetensors','pytorch_model*.bin'):
        for path in sorted(Path(directory).glob(pattern)):
            hashes[path.name]=file_digest(path)
    return hashes

def pin_materialized_weights(base_identity, model_path):
    """Record the physical weights actually loaded, including Hub snapshots."""
    hashes=weight_digests(model_path)
    if not hashes:
        raise ValueError('Materialized base has no model weights')
    recorded=base_identity.get('base_weights')
    if recorded and recorded!=hashes:
        raise ValueError('Materialized base weights differ from the recorded identity')
    return {**base_identity,'base_weights':hashes}

CHAT_FORMATTED={'rlvr':('prompt',),'dpo':('prompt','chosen','rejected'),'sft':('instruction','output'),'uncurated_sft':('instruction','output'),'schema_sft':('prompt','answer')}

def chat_formatted_dataset(source, destination, kind, tokenizer=None):
    """Train on the same chat-rendered user turn used at inference.

    scripts/generate_predictions.py renders each prompt with the tokenizer chat
    template. Plain-string rows bypass TRL's template, so an instruct model sees
    raw text with no assistant turn.

    - rlvr: prompt becomes a user message list; AlignTune preserves it for GRPO
      and TRL applies the template before generation.
    - dpo: AlignTune's DPO loader flattens message lists back to plain text, so
      the prompt is rendered here with the pinned tokenizer's own template
      (ending in the assistant header). TRL then appends tokenizer.eos_token
      to chosen/rejected, matching the template's assistant turn.
    """
    rows=read_jsonl(source)
    if not rows:
        raise ValueError(f'Training split {kind} is empty')
    if kind!='rlvr' and tokenizer is None:
        raise ValueError('Chat formatting requires the pinned tokenizer')
    prepared=[]
    for row in rows:
        row=dict(row)
        for field in CHAT_FORMATTED[kind]:
            value=row.get(field)
            if not isinstance(value,str) or not value.strip():
                raise ValueError(f'{kind} field {field} must be a non-empty string')
        if kind=='schema_sft':
            # Pilot: the schema task only (the website's use), prompt -> JSON answer.
            row['completion']=row.pop('answer')
            row.pop('ground_truth_json',None)
            prepared.append(row)
            continue
        if kind in ('sft','uncurated_sft'):
            # AlignTune turns prompt/completion into user/assistant messages and
            # TRL renders them with the chat template (identical to inference);
            # assistant_only_loss restricts the loss to the answer and <|im_end|>.
            # The prompt therefore stays raw here; rendering it would double-template.
            row['prompt']=row.pop('instruction')+(('\n'+row['input']) if row.get('input') else '')
            row.pop('input',None)
            row['completion']=row.pop('output')
            prepared.append(row)
            continue
        message=[{'role':'user','content':row['prompt']}]
        row['prompt']=message if kind=='rlvr' else tokenizer.apply_chat_template(message,tokenize=False,add_generation_prompt=True)
        prepared.append(row)
    write_jsonl(destination,prepared)
    info={'format':'chat_messages' if kind=='rlvr' else 'chat_template_rendered_prompt' if kind=='dpo' else 'messages_rendered_by_trl_assistant_only_loss','source':str(Path(source).resolve()),
        'source_sha256':file_digest(source),'prepared':str(Path(destination).resolve()),'prepared_sha256':file_digest(destination)}
    if kind!='rlvr':
        info.update(eos_token=tokenizer.eos_token,chat_template_sha256=digest(tokenizer.chat_template))
    return info

def training_outcome(output, adapter):
    """Measure whether the saved adapter differs from its initialization.

    PEFT initializes LoRA B to zeros, so an all-zero B after training proves no
    optimizer update was applied (for example, zero GRPO advantage).
    """
    metrics=None
    states=sorted(Path(output).glob('checkpoint-*/trainer_state.json'),key=lambda p:p.stat().st_mtime)
    if states:
        history=json.loads(states[-1].read_text()).get('log_history',[])
        logged=[entry for entry in history if 'loss' in entry or 'grad_norm' in entry]
        if logged:
            keep=('step','loss','grad_norm','learning_rate','reward','reward_std','frac_reward_zero_std',
                'completions/mean_length','completions/clipped_ratio','rewards/chosen','rewards/rejected','rewards/accuracies','rewards/margins')
            metrics={key:logged[-1][key] for key in keep if key in logged[-1]}
    config=json.loads((Path(adapter)/'adapter_config.json').read_text())
    updated=None
    if config.get('init_lora_weights') is True:
        from safetensors.torch import load_file
        tensors=load_file(str(Path(adapter)/'adapter_model.safetensors'))
        lora_b=[value for key,value in tensors.items() if 'lora_B' in key]
        if lora_b:
            updated=any(bool(value.abs().max()>0) for value in lora_b)
    return {'parameters_updated':updated,'trainer_metrics':metrics,
        'evidence':'LoRA B is zero-initialized; any nonzero B tensor proves an applied optimizer update' if updated is not None else 'not determinable from adapter initialization'}

def materialize_base(source, base_identity):
    """Load remote weights from the same immutable revision recorded in provenance."""
    if Path(source).is_dir():return str(Path(source).resolve())
    from huggingface_hub import snapshot_download
    return snapshot_download(repo_id=str(source), revision=base_identity["base_revision"], allow_patterns=["*.json","*.safetensors","*.model","*.txt","*.tiktoken","*.jinja"])

def resolve_shared_base(args):
    """An adapted vocabulary is optional; when selected it must exist explicitly."""
    selected = getattr(args, "shared_base", None)
    if selected is not None:
        path=Path(selected).resolve()
        if not path.is_dir():raise FileNotFoundError("The selected shared base does not exist")
        return path
    return Path(args.base).resolve() if Path(args.base).is_dir() else args.base


def assert_tokenizer_matches_model(tokenizer, model):
    """The tokenizer and the embedding matrix must agree on the vocabulary."""
    ids=list(tokenizer.get_vocab().values()) if hasattr(tokenizer,'get_vocab') else list(range(len(tokenizer)))
    for embedding in (model.get_input_embeddings(), model.get_output_embeddings()):
        if embedding is None: continue
        rows=int(embedding.weight.shape[0])
        if not ids or min(ids)<0 or max(ids)>=rows:
            raise ValueError('Tokenizer IDs exceed model embedding dimensions')
    # Qwen pads embedding rows beyond tokenizer vocabulary; exact length equality
    # incorrectly rejects this supported base model.

def check_data(args):
    manifest_path = args.data / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError("Run phase1_curatorkit_pipeline.py first")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("bootstrap_only", True) and not args.allow_bootstrap_data:
        raise ValueError("This dataset contains unreviewed synthetic or silver annotations. Supply reviewed data, or explicitly pass --allow-bootstrap-data for a smoke run.")
    for name, expected in manifest["files"].items():
        path = safe_dataset_file(args.data, name)
        if not path.is_file() or digest(path.read_bytes()) != expected:
            raise ValueError(f"Dataset manifest checksum mismatch: {name}")
    if not manifest.get("accepted") or manifest.get("empty_dataset"):
        raise ValueError("The curated dataset is empty")
    for kind in ("rlvr", "dpo", "sft", "uncurated_sft"):
        name=f"train/{kind}.jsonl"
        if name not in manifest["files"] or not read_jsonl(args.data/name):
            raise ValueError(f"Training split {kind} is missing or empty")
    return manifest

PILOT_ROOT=ROOT/'artifacts/pilot'

def validate_smoke_options(args):
    if getattr(args,'unreviewed_pilot',False):
        # Explicitly labelled research pilot on the unreviewed synthetic corpus.
        # Its adapters can never be merged, promoted or served as fine-tuned.
        if args.stage not in {'curated-sft','schema'} or not args.allow_bootstrap_data or getattr(args,'smoke_test',False):
            raise ValueError('--unreviewed-pilot supports curated-sft or schema with --allow-bootstrap-data only, and not with --smoke-test')
        if args.stage=='schema':
            # GRPO cold-starts with zero advantage on the base model; the pilot
            # starts from a verified SFT-merged pilot base instead.
            base=getattr(args,'shared_base',None)
            report=Path(base)/'suraksha_pilot_merge.json' if base else None
            if report is None or not Path(base).resolve().is_relative_to(PILOT_ROOT.resolve()) or not report.is_file():
                raise ValueError('Pilot GRPO requires --shared-base pointing to a pilot merge under artifacts/pilot')
            merge=json.loads(report.read_text())
            if not merge.get('unreviewed_pilot') or merge.get('merged_weights')!=weight_digests(base):
                raise ValueError('Pilot merged base is unlabelled or its weights changed after merging')
        manifest=json.loads((args.data/'manifest.json').read_text())
        if manifest.get('smoke_test_only'):
            raise ValueError('The pilot trains on the processed corpus, not the smoke fixtures')
        if not args.output.resolve().is_relative_to(PILOT_ROOT.resolve()):
            raise ValueError('Pilot outputs must remain under artifacts/pilot')
        return
    if args.allow_bootstrap_data:
        if not getattr(args,'smoke_test',False) or args.max_steps!=1:
            raise ValueError('Bootstrap override is restricted to an explicit one-step --smoke-test')
        manifest=json.loads((args.data/'manifest.json').read_text())
        rows=read_jsonl(args.data/'unified.jsonl')
        if not manifest.get('smoke_test_only') or not 1<=len(rows)<=2 or any(r['origin']!='synthetic' for r in rows):
            raise ValueError('Smoke run requires dedicated tiny synthetic-only fixture data')
        destination=args.output.resolve()
        if not destination.is_relative_to((ROOT/'artifacts/smoke-test').resolve()):
            raise ValueError('Smoke outputs must remain under artifacts/smoke-test')
    elif getattr(args,'smoke_test',False):
        raise ValueError('Synthetic smoke testing requires --allow-bootstrap-data')

def training_settings(args, torch):
    """Shared specialist settings; laptop profile is experimental smoke-only."""
    laptop=getattr(args, 'profile', 'default')=='laptop-6gb'
    pilot=getattr(args,'unreviewed_pilot',False)
    if laptop:
        smoke_ok=getattr(args,'smoke_test',False) and args.allow_bootstrap_data and args.max_steps==1 and args.stage in {'schema','empathy'}
        pilot_ok=pilot and args.allow_bootstrap_data and args.stage in {'curated-sft','schema'}
        if not (smoke_ok or pilot_ok):
            raise ValueError('laptop-6gb is restricted to one-step synthetic schema/empathy smoke tests or the labelled curated-sft pilot')
        if args.allow_cpu or not torch.cuda.is_available():
            raise ValueError('laptop-6gb requires CUDA; no CPU fallback')
    bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    common=dict(backend='trl',num_epochs=1,max_steps=args.max_steps,batch_size=1,
        learning_rate=5e-6,max_seq_length=1280 if laptop else 2048,seed=SEED,
        use_peft=True,lora_r=8 if laptop else 32,lora_alpha=16 if laptop else 64,
        lora_target_modules=['q_proj','v_proj'] if laptop else TARGET_MODULES,
        gradient_accumulation_steps=2,trust_remote_code=False,
        bf16=bf16,fp16=torch.cuda.is_available() and not bf16)
    if laptop and pilot and args.stage=='schema':
        # Pilot GRPO: fresh LoRA on the SFT-merged base; RL uses a small step.
        common.update(learning_rate=2e-5,max_seq_length=1280,lora_r=16,lora_alpha=32,
            lora_target_modules=TARGET_MODULES,gradient_accumulation_steps=4)
    elif laptop and pilot:
        # LoRA SFT needs a far larger step than RL fine-tuning; adapt all
        # projections so the pilot measures a meaningful adapter.
        common.update(learning_rate=1e-4,max_seq_length=1664 if getattr(args,'pilot_task','schema')=='dual' else 1280,lora_r=16,lora_alpha=32,
            lora_target_modules=TARGET_MODULES,gradient_accumulation_steps=8)
    if laptop:
        common.update(quantization={'load_in_4bit':True,'bnb_4bit_quant_type':'nf4',
            'bnb_4bit_use_double_quant':True,'bnb_4bit_compute_dtype':'bfloat16' if bf16 else 'float16'},
            precision='bf16' if bf16 else 'fp16',device_map={'':0},
            use_gradient_checkpointing=True,gradient_checkpointing=True,
            gradient_checkpointing_kwargs={'use_reentrant':False},
            optimizer='adamw_bnb_8bit',optim='adamw_bnb_8bit',optimizer_type='adamw_bnb_8bit',
            rollout_backend='hf',use_vllm=False,use_cache=False,
            logging_steps=5 if pilot else 1,save_steps=50 if pilot else 1,save_interval=50 if pilot else 1,save_total_limit=2 if pilot else 1,
            eval_strategy='no',report_to='none',loggers=[],caching_enabled=False,
            cache_dir=str(args.output/'cache'))
    specific={}
    if args.stage=='schema':
        specific=dict(algorithm='drgrpo',reward_functions=['suraksha_schema_exact'],
            field_mappings={'prompt':'prompt','answer':'answer'},preserve_columns=['answer','ground_truth_json'],
            num_generations=2,max_prompt_length=1024 if laptop else 1536,
            max_completion_length=256 if laptop else 512)
        if laptop: specific.update(loss_type='dr_grpo',beta=0.0,generation_batch_size=2)
        if laptop and pilot:
            # Four samples per prompt so rewards can differ within a group.
            specific.update(num_generations=4,generation_batch_size=4,temperature=0.9)
    elif args.stage=='empathy':
        specific=dict(algorithm='dpo',beta=.1,field_mappings={'prompt':'prompt','chosen':'chosen','rejected':'rejected'})
        if laptop:
            # TRL 1.7.1 DPO materializes full-vocabulary logits for every token.
            # Computing frozen-reference log-probs once, one pair at a time,
            # avoids a second logits tensor alongside the policy activations.
            # TRL reads precomputed log-probs back from a fingerprinted cache
            # file, which only exists for disk-backed datasets; keep_columns
            # restores the loaded (disk-backed) rows with identical content.
            specific.update(max_prompt_length=1024,max_completion_length=256,
                precompute_ref_log_probs=True,precompute_ref_batch_size=1,per_device_eval_batch_size=1,keep_columns=True)
    return common,specific

def register_reward():
    from aligntune.rewards.core import RewardConfig, RewardFunction, RewardType
    from aligntune.rewards.registry import RewardRegistry
    class BFSIReward(RewardFunction):
        def compute(self, text, reference=None, **kwargs):
            reference = reference or kwargs.get("answer") or kwargs.get("ground_truth_json")
            if reference is None:
                raise ValueError("Ground-truth answer missing from reward callback; do not train with an ungrounded reward")
            return extraction_reward(text, reference)
    RewardRegistry.register_custom_reward("suraksha_schema_exact", BFSIReward, RewardConfig(reward_type=RewardType.FINANCIAL_ACCURACY, device="cpu"))

def write_manifest(adapter, output, manifest):
    write_adapter_manifest(adapter, output, manifest)

def read_manifest(adapter):
    return read_adapter_manifest(adapter)


def train(args):
    validate_smoke_options(args)
    check_data(args)
    if getattr(args,'profile','default')=='laptop-6gb':
        # Must precede CUDA initialization; reduces fragmentation on 6 GB GPUs.
        import os
        os.environ.setdefault('PYTORCH_CUDA_ALLOC_CONF','expandable_segments:True')
    torch = require_gpu(args.allow_cpu)
    from aligntune.core.backend_factory import create_rl_trainer, create_sft_trainer
    common,specific=training_settings(args,torch)
    shared_base=resolve_shared_base(args)
    output=args.output/args.stage
    if output.exists() and ((output/'adapter_model.safetensors').exists() or any(output.glob('checkpoint-*'))):
        raise ValueError('This output already contains checkpoints; choose a fresh --output')
    check_only=getattr(args,'check_config',False)
    shared_identity=None
    if check_only:
        model_path=str(shared_base) # Factory configuration only: no weight materialization.
    else:
        shared_identity=identity(str(shared_base),getattr(args,'revision',None))
        shared_identity.update(rank=common['lora_r'],alpha=common['lora_alpha'],target_modules=common['lora_target_modules'])
        model_path=materialize_base(shared_base,shared_identity)
        shared_identity=pin_materialized_weights(shared_identity,model_path)
    if args.stage=='schema': register_reward()
    kind='rlvr' if args.stage=='schema' else 'dpo' if args.stage=='empathy' else 'sft' if args.stage=='curated-sft' else 'uncurated_sft'
    if getattr(args,'unreviewed_pilot',False) and args.stage=='curated-sft':
        # schema: train/rlvr.jsonl (longest 1,124 tokens). dual: train/sft.jsonl,
        # schema + reply records (longest 1,623 tokens); fits only with chunked_nll.
        kind='schema_sft' if getattr(args,'pilot_task','schema')=='schema' else 'sft'
    dataset_path=args.data/'train'/(('rlvr' if kind=='schema_sft' else kind)+'.jsonl')
    training_data={'format':'source','source':str(dataset_path.resolve()),'source_sha256':file_digest(dataset_path)} if dataset_path.is_file() else None
    if kind in CHAT_FORMATTED:
        tokenizer=None
        if kind!='rlvr':
            from transformers import AutoTokenizer
            local=Path(str(model_path)).is_dir()
            tokenizer=AutoTokenizer.from_pretrained(model_path,revision=None if local else getattr(args,'revision',None),trust_remote_code=False)
        training_data=chat_formatted_dataset(dataset_path,output/'prepared'/(kind+'.jsonl'),kind,tokenizer)
        dataset_path=Path(training_data['prepared'])
    factory_kwargs=dict(common,model_name=model_path,output_dir=str(output),dataset_name=str(dataset_path))
    if args.stage in {'schema','empathy'}:
        trainer=create_rl_trainer(**factory_kwargs,**specific)
    else:
        trainer=create_sft_trainer(**factory_kwargs,assistant_only_loss=True,field_mappings={'prompt':'prompt','completion':'completion'})
        if getattr(args,'unreviewed_pilot',False):
            # TRL 1.7.1 chunked_nll: identical NLL, but lm_head runs only on
            # unmasked tokens in chunks (no full-vocabulary logits). Valid since
            # lm_head carries no LoRA. AlignTune's validator predates it and
            # accepts only nll/dft, so it is set after construction.
            trainer.config.train.loss_type='chunked_nll'
    if getattr(args,'profile','default')=='laptop-6gb':
        trainer.config.model.attn_implementation='sdpa'
        # Pinned DPO backend reads optimizer_type; its dataclass stores optimizer.
        # Keep both aliases explicit instead of silently reverting to AdamW fp32.
        trainer.config.train.optimizer_type=common['optimizer_type']
        actual=trainer.config.model
        peft=getattr(actual,'peft',None)
        if peft is not None: # SFT config layout
            retained=(peft.rank,peft.alpha,list(peft.target_modules),actual.max_seq_length)
            if trainer.config.train.assistant_only_loss is not True or (getattr(args,'unreviewed_pilot',False) and trainer.config.train.loss_type!='chunked_nll'): raise ValueError('AlignTune did not retain assistant-only chunked SFT loss')
        else:
            retained=(actual.lora_r,actual.lora_alpha,actual.lora_target_modules,trainer.config.train.max_length)
        if actual.quantization!=common['quantization'] or retained!=(common['lora_r'],common['lora_alpha'],common['lora_target_modules'],common['max_seq_length']) or not actual.gradient_checkpointing:
            raise ValueError('AlignTune did not retain the requested QLoRA configuration')
        if args.stage=='empathy':
            extra=getattr(trainer.config.train,'extra_params',None) or {}
            if any(extra.get(key)!=specific[key] for key in ('precompute_ref_log_probs','precompute_ref_batch_size','per_device_eval_batch_size')):
                raise ValueError('AlignTune did not retain the DPO reference-precompute memory settings')
    if check_only:
        # Reward setup instantiates the custom registry scorer, without model loading.
        reward_scores=None
        if args.stage=='schema':
            trainer.setup_rewards()
            row=read_jsonl(args.data/'train/rlvr.jsonl')[0]
            reward_scores=trainer.prepared_rewards.functions[0](prompts=[row['prompt']],completions=[row['answer']],answer=[row['answer']],ground_truth_json=[row['ground_truth_json']])
            if reward_scores!=[1.0]: raise ValueError('Actual AlignTune reward bridge failed the exact JSON fixture')
            # Chat-formatted rollouts reach rewards as assistant message lists.
            chat_scores=trainer.prepared_rewards.functions[0](prompts=[[{'role':'user','content':row['prompt']}]],completions=[[{'role':'assistant','content':row['answer']}]],answer=[row['answer']],ground_truth_json=[row['ground_truth_json']])
            if chat_scores!=[1.0]: raise ValueError('Actual AlignTune reward bridge failed the chat-formatted JSON fixture')
            reward_scores={'string':reward_scores,'chat_messages':chat_scores}
        report={'status':'PASSED','scope':'actual AlignTune factory/config and custom reward setup; no model weights or optimizer step',
            'profile':getattr(args,'profile','default'),'stage':args.stage,'settings':common,'algorithm_settings':specific,
            'trainer_class':type(trainer).__name__,'fixture_reward_scores':reward_scores,'training_data':training_data,'training_started':False,'weights_loaded':False,
            'memory_fit':'UNVERIFIED until actual one-step execution'}
        output.mkdir(parents=True,exist_ok=True)
        (output/'config_check.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2));return
    laptop=getattr(args,'profile','default')=='laptop-6gb'
    if laptop: torch.cuda.reset_peak_memory_stats()
    try:
        trainer.train()
    except torch.cuda.OutOfMemoryError:
        output.mkdir(parents=True,exist_ok=True)
        (output/'oom_report.json').write_text(json.dumps({'status':'BLOCKED_BY_GPU_MEMORY','profile':getattr(args,'profile','default'),'stage':args.stage,'completed':False,'peak_cuda_allocated_bytes':torch.cuda.max_memory_allocated(),'peak_cuda_reserved_bytes':torch.cuda.max_memory_reserved()},indent=2)+'\n')
        raise RuntimeError('GPU memory exhausted. This smoke run did not complete; no training-readiness claim is valid. Use a larger GPU or a smaller base in a fresh smoke output directory.') from None
    output = args.output / args.stage
    output.mkdir(parents=True, exist_ok=True)
    # Trainers normally persist their final model. Verify it rather than claim it.
    candidates = [output] + sorted(output.glob("checkpoint-*"), key=lambda p: p.stat().st_mtime, reverse=True)
    adapter = next((p for p in candidates if (p / "adapter_config.json").exists() and (p / "adapter_model.safetensors").exists()), None)
    if adapter is None:
        raise RuntimeError("Trainer returned without a saved LoRA adapter. Inspect its output before continuing.")
    manifest = {"identity": shared_identity, "dataset_manifest_sha256": digest((args.data / "manifest.json").read_bytes()), "algorithm": "drgrpo" if args.stage == "schema" else "dpo" if args.stage == "empathy" else "sft", "versions": package_versions(), "stage": args.stage, "seed": SEED, "profile": getattr(args,"profile","default"), "training_settings": common, "peak_cuda_allocated_bytes": torch.cuda.max_memory_allocated() if laptop else None, "peak_cuda_reserved_bytes": torch.cuda.max_memory_reserved() if laptop else None, "bootstrap_smoke_run": args.allow_bootstrap_data, "smoke_test_only": getattr(args,"smoke_test",False), "unreviewed_pilot": getattr(args,"unreviewed_pilot",False), "pilot_task": getattr(args,"pilot_task",None) if getattr(args,"unreviewed_pilot",False) else None, "adapter_path": str(adapter.resolve()), "training_data": training_data}
    manifest["training_outcome"] = training_outcome(output, adapter)
    write_manifest(adapter, output, manifest)
    print(json.dumps(manifest, indent=2))
    if manifest["training_outcome"]["parameters_updated"] is False:
        raise RuntimeError("Training executed but the saved adapter equals its initialization (all LoRA B tensors are zero): no optimizer update was applied. See training_outcome.trainer_metrics in the manifest.")

def adapt_tokenizer(args):
    """Adapt one shared embedding base before either specialist is trained."""
    check_data(args)
    torch = require_gpu(args.allow_cpu)
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from aligntune.core.tokenization.extension import TokenizerExtender
    # Seed before the embedding resize so the new rows are reproducible.
    torch.manual_seed(SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(SEED)
    texts = [r["prompt"] + "\n" + r["answer"] for r in read_jsonl(args.data / "train/rlvr.jsonl")]
    if not texts:
        raise ValueError("Empty training corpus")
    output = args.output / "shared-indic-base"
    tokenizer = AutoTokenizer.from_pretrained(args.base, trust_remote_code=False)
    old_size = len(tokenizer)
    extender = TokenizerExtender(tokenizer, target_vocab_size=old_size + 128)
    extender.extend_for_scripts(["devanagari", "tamil"], texts, num_new_tokens=64)
    extender.save_extended_tokenizer(str(output / "tokenizer-extension-metadata"))
    # AlignTune exports extension metadata; add its candidates to the actual
    # HF tokenizer, then save that tokenizer with the shared adapted model.
    tokenizer.add_tokens(list(extender.extended_vocab))
    tokenizer.add_tokens(["चार्जबैक", "धोखाधड़ी", "paise", "UDIR", "UTR", "NPCI"])
    if len(tokenizer) <= old_size:
        raise ValueError("No tokens added; do not label an unchanged tokenizer as extended")
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForCausalLM.from_pretrained(args.base, trust_remote_code=False)
    model.resize_token_embeddings(len(tokenizer))
    assert_tokenizer_matches_model(tokenizer, model)
    model.to(device)
    for parameter in model.parameters():
        parameter.requires_grad_(False)
    parameters = list({id(p): p for module in (model.get_input_embeddings(), model.get_output_embeddings()) for p in module.parameters()}.values())
    for parameter in parameters:
        parameter.requires_grad_(True)
        parameter.register_hook(lambda grad: torch.cat([torch.zeros_like(grad[:old_size]), grad[old_size:]], dim=0))
    optimizer = torch.optim.AdamW(parameters, lr=1e-4, weight_decay=0.0)
    model.train()
    losses = []
    for step in range(args.max_steps):
        batch = tokenizer(texts[step % len(texts)], return_tensors="pt", truncation=True, max_length=1024).to(device)
        loss = model(**batch, labels=batch["input_ids"]).loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        losses.append(float(loss.detach()))
    model.save_pretrained(output, safe_serialization=True)
    tokenizer.save_pretrained(output)
    report = {"base": args.base, "old_vocab": old_size, "new_vocab": len(tokenizer), "steps": args.max_steps, "seed": SEED, "tokenizer_sha256": digest(tokenizer.get_vocab()), "training_losses": losses, "human_quality_evaluated": False, "shared_base_for_both_adapters": str(output.resolve())}
    (output / "embedding_adaptation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

def merge(args):
    check_data(args)
    torch = require_gpu(args.allow_cpu)
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    from aligntune.core.merge.peft_merger import PEFTMerger
    shared_base = resolve_shared_base(args)
    resolved = [resolve_adapter(path) for path in (args.schema_adapter, args.empathy_adapter)]
    adapters = [item[0] for item in resolved]
    manifests = [item[1] for item in resolved]
    if manifests[0]["identity"] != manifests[1]["identity"]:
        raise ValueError("Adapters differ in base revision/weights, tokenizer, rank, alpha or target modules")
    if any(m.get("smoke_test_only") or m.get("bootstrap_smoke_run") or m.get("unreviewed_pilot") for m in manifests):
        raise ValueError("Synthetic smoke adapters cannot be merged as final artifacts")
    if any((m.get("training_outcome") or {}).get("parameters_updated") is not True for m in manifests):
        raise ValueError("Both adapters must have a verified, applied optimizer update")
    if [m["stage"] for m in manifests] != ["schema", "empathy"]:
        raise ValueError("Expected schema and empathy specialist adapters, in that order")
    revision = manifests[0]["identity"].get("base_revision")
    current = identity(str(shared_base), revision)
    # The tokenizer must come from the adapted base, not the original one.
    model_path = materialize_base(shared_base, current)
    if manifests[0]["identity"] != pin_materialized_weights(current, model_path):
        raise ValueError("Selected base is not the shared base used by both specialists")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=False)
    dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float32
    base = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype=dtype, trust_remote_code=False)
    assert_tokenizer_matches_model(tokenizer, base)
    model = PeftModel.from_pretrained(base, str(adapters[0]), adapter_name="schema")
    model.load_adapter(str(adapters[1]), adapter_name="empathy")
    # Concatenation preserves the exact weighted sum of B@A updates. A linear
    # average of the low-rank factors would introduce unintended cross terms.
    model.add_weighted_adapter(["schema", "empathy"], [args.schema_weight, 1 - args.schema_weight], "suraksha", combination_type="cat")
    model.set_adapter("suraksha")
    destination = args.output / "suraksha-merged"
    PEFTMerger().merge_lora(base_model=model, tokenizer=tokenizer, output_path=str(destination))
    report = {"method": "weighted_delta_task_arithmetic_via_cat", "weights": [args.schema_weight, 1 - args.schema_weight], "identity": manifests[0]["identity"], "adapters": [str(p.resolve()) for p in adapters], "versions": package_versions(), "evaluated": False, "generation_calls_per_ticket": 2}
    (destination / "suraksha_merge_manifest.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", choices=STAGES, default="plan")
    parser.add_argument("--base", default=BASE_MODEL)
    parser.add_argument("--revision", help="Optional immutable Hugging Face revision; resolved and pinned before weight loading")
    parser.add_argument("--shared-base", type=Path, default=None, help="Optional adapted base shared by both specialists; omit to keep the original vocabulary")
    parser.add_argument("--data", type=Path, default=ROOT / "data/generated")
    parser.add_argument("--output", type=Path, default=ROOT / "checkpoints")
    parser.add_argument("--schema-adapter", type=Path, default=ROOT / "checkpoints/schema")
    parser.add_argument("--empathy-adapter", type=Path, default=ROOT / "checkpoints/empathy")
    parser.add_argument("--schema-weight", type=float, default=0.55)
    parser.add_argument("--max-steps", type=int, default=100)
    parser.add_argument("--allow-bootstrap-data", action="store_true")
    parser.add_argument("--smoke-test", action="store_true", help="One-step synthetic fixture training, isolated under artifacts/smoke-test")
    parser.add_argument("--allow-cpu", action="store_true")
    parser.add_argument("--profile", choices=["default","laptop-6gb"], default="default")
    parser.add_argument("--pilot-task", choices=["schema","dual"], default="schema", help="Pilot SFT data: schema answers only, or schema + customer reply records")
    parser.add_argument("--unreviewed-pilot", action="store_true", help="Labelled curated-sft pilot on the unreviewed synthetic corpus; outputs under artifacts/pilot, never mergeable")
    parser.add_argument("--check-config", action="store_true", help="Instantiate AlignTune configuration/rewards only; no weights or training")
    args = parser.parse_args()
    if not 0 <= args.schema_weight <= 1 or args.max_steps < 1:
        parser.error("Weights must be between 0 and 1; steps must be positive")
    if args.profile=="laptop-6gb" and args.stage not in {"schema","empathy"} and not (args.unreviewed_pilot and args.stage=="curated-sft"):
        parser.error("laptop-6gb supports schema/empathy smoke tests only")
    if args.check_config and args.stage not in {"schema","empathy"} and not (args.unreviewed_pilot and args.stage=="curated-sft"):
        parser.error("--check-config supports schema/empathy, or the curated-sft pilot")
    if args.stage == "plan":
        print(json.dumps({"executed": False, "base": args.base, "shared_base": str(args.shared_base) if args.shared_base else args.base, "stages": STAGES[1:], "versions": package_versions(), "shared_vocabulary_required": True, "default_tokenizer": "unchanged until adapt-tokenizer is explicitly run", "weights": [args.schema_weight, round(1-args.schema_weight, 6)], "measured_results": None}, indent=2))
    elif args.stage == "merge":
        if args.allow_bootstrap_data: parser.error("Merge requires reviewed data")
        merge(args)
    elif args.stage == "adapt-tokenizer":
        if args.allow_bootstrap_data: parser.error("Tokenizer adaptation requires reviewed data")
        adapt_tokenizer(args)
    else:
        train(args)
if __name__ == "__main__":
    main()
