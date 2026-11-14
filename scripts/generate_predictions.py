"""Generate real, unrepaired two-task predictions from one HF checkpoint.

Both calls use the same model. Timing includes both calls; no cost is fabricated.
"""
import argparse
import json
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from research.common import ROOT, digest, read_jsonl, write_jsonl
from phase2_aligntune_train_and_merge import identity, materialize_base, pin_materialized_weights
from research.artifacts import resolve_adapter

def merge_kind(model):
    """kind recorded by scripts/merge_pilot_adapter.py, or None for a hub model."""
    report = Path(model) / "suraksha_pilot_merge.json"
    return json.loads(report.read_text()).get("kind") if report.is_file() else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--adapter", type=Path)
    parser.add_argument("--revision")
    parser.add_argument("--benchmark", type=Path, default=ROOT / "data/generated/test/benchmark.jsonl")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--allow-cpu", action="store_true")
    parser.add_argument("--max-new-tokens", type=int, default=768)
    parser.add_argument("--quantization", choices=["auto", "nf4"], default="auto", help="nf4 loads the base in 4-bit for small GPUs; recorded in the manifest")
    parser.add_argument("--allow-pilot-adapter", action="store_true", help="Evaluate an unreviewed-pilot adapter; outputs stay labelled as pilot")
    args = parser.parse_args()
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    if not torch.cuda.is_available() and not args.allow_cpu:
        parser.error("No working CUDA GPU. --allow-cpu is for explicit small smoke runs.")
    if args.max_new_tokens < 1:
        parser.error("Token limit must be positive")
    model_identity = identity(args.model, args.revision)
    model_path = materialize_base(args.model, model_identity)
    model_identity = pin_materialized_weights(model_identity, model_path)
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=False)
    load = dict(device_map="auto", trust_remote_code=False, dtype="auto")
    if args.quantization == "nf4":
        from transformers import BitsAndBytesConfig
        compute = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        load = dict(device_map={"": 0}, trust_remote_code=False, quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=compute))
    model = AutoModelForCausalLM.from_pretrained(model_path, **load)
    adapter_manifest = None
    if args.adapter:
        from peft import PeftModel
        adapter, adapter_manifest = resolve_adapter(args.adapter)
        recorded = adapter_manifest.get("identity") or {}
        # Rank/modules legitimately differ per adapter; the base must not.
        if any(recorded.get(key) != model_identity.get(key) for key in ("base_revision", "base_weights", "tokenizer_sha256")):
            raise ValueError("Adapter and selected base/tokenizer identities do not match")
        if (adapter_manifest.get("training_outcome") or {}).get("parameters_updated") is not True:
            raise ValueError("Adapter has no verified optimizer update")
        if adapter_manifest.get("smoke_test_only"):
            raise ValueError("Smoke-test adapters are not evaluated")
        if adapter_manifest.get("unreviewed_pilot") and not args.allow_pilot_adapter:
            raise ValueError("Unreviewed-pilot adapter: pass --allow-pilot-adapter to evaluate it as a labelled pilot")
        model = PeftModel.from_pretrained(model, str(adapter))
    model.eval()
    records = []
    for sample in read_jsonl(args.benchmark):
        parts, input_tokens, output_tokens = [], 0, 0
        if torch.cuda.is_available(): torch.cuda.synchronize()
        started = time.perf_counter()
        for task_index, prompt in enumerate((sample["schema_prompt"], sample["reply_prompt"])):
            if task_index == 1:
                prompt += "\nTRIAGE CONTEXT (model draft, may be wrong; verify against the message):\n" + parts[0]
            rendered = tokenizer.apply_chat_template([{"role": "user", "content": prompt}], tokenize=False, add_generation_prompt=True)
            encoded = tokenizer(rendered, return_tensors="pt").to(model.device)
            count = encoded["input_ids"].shape[1]
            with torch.inference_mode():
                generated = model.generate(**encoded, do_sample=False, max_new_tokens=args.max_new_tokens, pad_token_id=tokenizer.eos_token_id)
            tokens = generated[0, count:]
            parts.append(tokenizer.decode(tokens, skip_special_tokens=True))
            input_tokens += count
            output_tokens += len(tokens)
        if torch.cuda.is_available(): torch.cuda.synchronize()
        records.append({"sample_id": sample["sample_id"], "prediction": parts[0]+"\n---REPLY---\n"+parts[1], "latency_seconds": time.perf_counter()-started, "input_tokens": input_tokens, "output_tokens": output_tokens, "model": args.model, "adapter": str(args.adapter) if args.adapter else None, "generation_calls": 2})
    write_jsonl(args.output, records)
    manifest = {"benchmark_sha256": digest(args.benchmark.read_bytes()), "predictions_sha256": digest(args.output.read_bytes()), "model": args.model, "identity": model_identity, "hf_revision": model_identity["base_revision"], "quantization": args.quantization, "adapter_unreviewed_pilot": bool(adapter_manifest and adapter_manifest.get("unreviewed_pilot")), "model_unreviewed_pilot_merge": merge_kind(args.model) == "unreviewed_pilot_merged_base", "model_reviewed_merge": merge_kind(args.model) == "reviewed_merged_base", "adapter_sha256": adapter_manifest["artifacts"]["adapter_model.safetensors"] if adapter_manifest else None, "adapter": str(args.adapter) if args.adapter else None, "device": str(model.device), "gpu": torch.cuda.get_device_name() if torch.cuda.is_available() else None, "do_sample": False, "max_new_tokens_per_call": args.max_new_tokens, "generation_calls_per_ticket": 2, "repairs_applied": False}
    args.output.with_suffix(".manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps(manifest, indent=2))
if __name__ == "__main__": main()
