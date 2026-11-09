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

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--adapter", type=Path)
    parser.add_argument("--benchmark", type=Path, default=ROOT / "data/generated/test/benchmark.jsonl")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--allow-cpu", action="store_true")
    parser.add_argument("--max-new-tokens", type=int, default=768)
    args = parser.parse_args()
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    if not torch.cuda.is_available() and not args.allow_cpu:
        parser.error("No working CUDA GPU. --allow-cpu is for explicit small smoke runs.")
    if args.max_new_tokens < 1:
        parser.error("Token limit must be positive")
    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(args.model, device_map="auto", trust_remote_code=False, torch_dtype="auto")
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, str(args.adapter))
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
    manifest = {"benchmark_sha256": digest(args.benchmark.read_bytes()), "predictions_sha256": digest(args.output.read_bytes()), "model": args.model, "hf_revision": getattr(model.config, "_commit_hash", None), "adapter": str(args.adapter) if args.adapter else None, "device": str(model.device), "gpu": torch.cuda.get_device_name() if torch.cuda.is_available() else None, "do_sample": False, "max_new_tokens_per_call": args.max_new_tokens, "generation_calls_per_ticket": 2, "repairs_applied": False}
    args.output.with_suffix(".manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps(manifest, indent=2))
if __name__ == "__main__": main()
