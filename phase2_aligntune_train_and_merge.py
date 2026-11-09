"""GPU training entry points using source-checked AlignTune APIs.

No model is downloaded in plan mode. Bootstrap data is explicitly gated.
"""
from __future__ import annotations
import argparse
import importlib.metadata
import json
from pathlib import Path
from research.common import ROOT, digest, extraction_reward, read_jsonl

BASE_MODEL = "Qwen/Qwen2.5-3B-Instruct"
TARGET_MODULES = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
STAGES = ["plan", "adapt-tokenizer", "schema", "empathy", "curated-sft", "uncurated-sft", "merge"]

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

def identity(model_name):
    from transformers import AutoConfig, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(model_name, trust_remote_code=False)
    config = AutoConfig.from_pretrained(model_name, trust_remote_code=False)
    # Include actual local model bytes for adapted bases and an immutable HF
    # revision for downloaded bases. A matching path/name alone is insufficient.
    model_path = Path(model_name)
    weight_hashes = {}
    if model_path.is_dir():
        for pattern in ("*.safetensors", "pytorch_model*.bin"):
            for path in sorted(model_path.glob(pattern)):
                import hashlib
                h = hashlib.sha256()
                with path.open("rb") as stream:
                    for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
                        h.update(block)
                weight_hashes[path.name] = h.hexdigest()
        if not weight_hashes:
            raise ValueError("Local shared base has no model weights")
    revision = getattr(config, "_commit_hash", None)
    if not weight_hashes and not revision:
        raise ValueError("Could not resolve an immutable shared-base revision")
    return {"base_model": model_name, "base_revision": revision, "base_weights": weight_hashes, "tokenizer_sha256": digest(tok.get_vocab()), "tokenizer_size": len(tok), "target_modules": TARGET_MODULES, "rank": 32, "alpha": 64}

def check_data(args):
    manifest_path = args.data / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError("Run phase1_curatorkit_pipeline.py first")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("bootstrap_only", True) and not args.allow_bootstrap_data:
        raise ValueError("Bundled seeds are unreviewed bootstrap data. Supply human-reviewed data, or explicitly pass --allow-bootstrap-data for a smoke run.")
    for name, expected in manifest["files"].items():
        path = args.data / name
        if not path.is_file() or digest(path.read_bytes()) != expected:
            raise ValueError(f"Dataset manifest checksum mismatch: {name}")
    return manifest

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

def train(args):
    check_data(args)
    torch = require_gpu(args.allow_cpu)
    from aligntune.core.backend_factory import create_rl_trainer, create_sft_trainer
    shared_identity = identity(args.base)
    common = dict(model_name=args.base, backend="trl", output_dir=str(args.output / args.stage), num_epochs=1, max_steps=args.max_steps, batch_size=1, learning_rate=5e-6, max_seq_length=2048, seed=42, use_peft=True, lora_r=32, lora_alpha=64, lora_target_modules=TARGET_MODULES, gradient_accumulation_steps=2, trust_remote_code=False, bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(), fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported())
    if args.stage == "schema":
        register_reward()
        trainer = create_rl_trainer(**common, dataset_name=str(args.data / "train/rlvr.jsonl"), algorithm="drgrpo", reward_functions=["suraksha_schema_exact"], field_mappings={"prompt": "prompt", "answer": "answer"}, preserve_columns=["answer", "ground_truth_json"], num_generations=2, max_prompt_length=1536, max_completion_length=512)
    elif args.stage == "empathy":
        trainer = create_rl_trainer(**common, dataset_name=str(args.data / "train/dpo.jsonl"), algorithm="dpo", beta=0.1, field_mappings={"prompt": "prompt", "chosen": "chosen", "rejected": "rejected"})
    else:
        dataset = "sft" if args.stage == "curated-sft" else "uncurated_sft"
        trainer = create_sft_trainer(**common, dataset_name=str(args.data / f"train/{dataset}.jsonl"), field_mappings={"instruction": "instruction", "input": "input", "output": "output"})
    trainer.train()
    output = args.output / args.stage
    output.mkdir(parents=True, exist_ok=True)
    # Trainers normally persist their final model. Verify it rather than claim it.
    candidates = [output] + sorted(output.glob("checkpoint-*"), key=lambda p: p.stat().st_mtime, reverse=True)
    adapter = next((p for p in candidates if (p / "adapter_config.json").exists() and (p / "adapter_model.safetensors").exists()), None)
    if adapter is None:
        raise RuntimeError("Trainer returned without a saved LoRA adapter. Inspect its output before continuing.")
    manifest = {"identity": shared_identity, "dataset_manifest_sha256": digest((args.data / "manifest.json").read_bytes()), "algorithm": "drgrpo" if args.stage == "schema" else "dpo" if args.stage == "empathy" else "sft", "versions": package_versions(), "stage": args.stage, "seed": 42, "bootstrap_smoke_run": args.allow_bootstrap_data, "adapter_path": str(adapter.resolve())}
    (adapter / "suraksha_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))

def adapt_tokenizer(args):
    """Adapt one shared embedding base before either specialist is trained."""
    check_data(args)
    torch = require_gpu(args.allow_cpu)
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from aligntune.core.tokenization.extension import TokenizerExtender
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
    report = {"base": args.base, "old_vocab": old_size, "new_vocab": len(tokenizer), "steps": args.max_steps, "training_losses": losses, "human_quality_evaluated": False, "shared_base_for_both_adapters": str(output.resolve())}
    (output / "embedding_adaptation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

def merge(args):
    torch = require_gpu(args.allow_cpu)
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    from aligntune.core.merge.peft_merger import PEFTMerger
    adapters = [args.schema_adapter, args.empathy_adapter]
    manifests = [json.loads((p / "suraksha_manifest.json").read_text()) for p in adapters]
    if manifests[0]["identity"] != manifests[1]["identity"]:
        raise ValueError("Adapters differ in base revision/weights, tokenizer, rank, alpha or target modules")
    if manifests[0]["identity"] != identity(args.base):
        raise ValueError("Selected base is not the shared base used by both specialists")
    if [m["stage"] for m in manifests] != ["schema", "empathy"]:
        raise ValueError("Expected schema and empathy specialist adapters, in that order")
    tokenizer = AutoTokenizer.from_pretrained(args.base, trust_remote_code=False)
    dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float32
    base = AutoModelForCausalLM.from_pretrained(args.base, torch_dtype=dtype, trust_remote_code=False)
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
    parser.add_argument("--data", type=Path, default=ROOT / "data/generated")
    parser.add_argument("--output", type=Path, default=ROOT / "checkpoints")
    parser.add_argument("--schema-adapter", type=Path, default=ROOT / "checkpoints/schema")
    parser.add_argument("--empathy-adapter", type=Path, default=ROOT / "checkpoints/empathy")
    parser.add_argument("--schema-weight", type=float, default=0.55)
    parser.add_argument("--max-steps", type=int, default=100)
    parser.add_argument("--allow-bootstrap-data", action="store_true")
    parser.add_argument("--allow-cpu", action="store_true")
    args = parser.parse_args()
    if not 0 <= args.schema_weight <= 1 or args.max_steps < 1:
        parser.error("Weights must be between 0 and 1; steps must be positive")
    if args.stage == "plan":
        print(json.dumps({"executed": False, "base": args.base, "stages": STAGES[1:], "versions": package_versions(), "shared_vocabulary_required": True, "default_tokenizer": "unchanged until adapt-tokenizer is explicitly run", "weights": [args.schema_weight, round(1-args.schema_weight, 6)], "measured_results": None}, indent=2))
    elif args.stage == "merge":
        merge(args)
    elif args.stage == "adapt-tokenizer":
        adapt_tokenizer(args)
    else:
        train(args)
if __name__ == "__main__":
    main()
