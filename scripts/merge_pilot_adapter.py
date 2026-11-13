"""Merge a verified unreviewed-pilot SFT adapter into the pinned base (CPU, bf16).

The merged model is a pilot artifact: a warm start for pilot GRPO and a faster
pilot server (no LoRA overhead at inference). It is never a reviewed model.
Uses AlignTune's PEFTMerger; the base tokenizer is passed explicitly so the
merged model keeps the original chat template.

  .venv-training/bin/python scripts/merge_pilot_adapter.py \
    --adapter artifacts/pilot/schema-sft-001/curated-sft \
    --output artifacts/pilot/merged-schema-sft-001

Pilot step 5 (schema + empathy specialists), the same weighted "cat" task
arithmetic as phase2 --stage merge, but for labelled pilot adapters only:

  .venv-training/bin/python scripts/merge_pilot_adapter.py \
    --adapter artifacts/pilot/schema-sft-001/curated-sft \
    --empathy-adapter artifacts/pilot/dpo-001/empathy --schema-weight 0.55 \
    --output artifacts/pilot/merged-schema-empathy-001
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from research.common import ROOT, digest
from research.artifacts import resolve_adapter
from phase2_aligntune_train_and_merge import BASE_MODEL, identity, materialize_base, pin_materialized_weights, weight_digests, package_versions

PINNED_REVISION = "aa8e72537993ba99e69dfaafa59ed015b17504d1"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--adapter", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--revision", default=PINNED_REVISION)
    parser.add_argument("--empathy-adapter", type=Path, help="Pilot DPO adapter to combine with --adapter (pilot step 5)")
    parser.add_argument("--schema-weight", type=float, default=0.55)
    args = parser.parse_args()
    if not 0 <= args.schema_weight <= 1:
        parser.error("--schema-weight must be between 0 and 1")
    if not args.output.resolve().is_relative_to((ROOT / "artifacts/pilot").resolve()):
        parser.error("Pilot merges must stay under artifacts/pilot")
    if args.output.exists() and any(args.output.glob("*.safetensors")):
        parser.error("Output already contains weights; choose a fresh --output")
    adapter, manifest = resolve_adapter(args.adapter)
    resolved = [(adapter, manifest)] + ([resolve_adapter(args.empathy_adapter)] if args.empathy_adapter else [])
    for _, m in resolved:
        if not m.get("unreviewed_pilot"):
            parser.error("This script only merges labelled pilot adapters; reviewed adapters use phase2 --stage merge")
        if (m.get("training_outcome") or {}).get("parameters_updated") is not True:
            parser.error("Adapter has no verified optimizer update")
    if args.empathy_adapter:
        empathy_manifest = resolved[1][1]
        if manifest.get("stage") == "empathy" or empathy_manifest.get("stage") != "empathy":
            parser.error("Pass the schema pilot as --adapter and the DPO pilot as --empathy-adapter")
        if manifest.get("identity") != empathy_manifest.get("identity"):
            parser.error("Adapters differ in base revision/weights, tokenizer, rank, alpha or target modules")
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    from aligntune.core.merge.peft_merger import PEFTMerger
    base_identity = identity(BASE_MODEL, args.revision)
    model_path = materialize_base(BASE_MODEL, base_identity)
    base_identity = pin_materialized_weights(base_identity, model_path)
    recorded = manifest.get("identity") or {}
    for key in ("base_revision", "base_weights", "tokenizer_sha256"):
        if recorded.get(key) != base_identity.get(key):
            parser.error(f"Adapter was trained on a different base ({key} mismatch)")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=False)
    # Full-precision bf16 merge on CPU: merging into NF4 weights would bake in
    # quantization error; NF4 is applied again when the merged model is loaded.
    base = AutoModelForCausalLM.from_pretrained(model_path, dtype=torch.bfloat16, device_map={"": "cpu"}, trust_remote_code=False)
    if args.empathy_adapter:
        model = PeftModel.from_pretrained(base, str(adapter), adapter_name="schema")
        model.load_adapter(str(resolved[1][0]), adapter_name="empathy")
        # Concatenation keeps the exact weighted sum of B@A updates (as phase2 merge).
        model.add_weighted_adapter(["schema", "empathy"], [args.schema_weight, 1 - args.schema_weight], "suraksha", combination_type="cat")
        model.set_adapter("suraksha")
        model.delete_adapter("schema"); model.delete_adapter("empathy")
    else:
        model = PeftModel.from_pretrained(base, str(adapter))
    PEFTMerger().merge_lora(base_model=model, tokenizer=tokenizer, output_path=str(args.output))
    merged_tokenizer = AutoTokenizer.from_pretrained(args.output, trust_remote_code=False)
    if merged_tokenizer.chat_template != tokenizer.chat_template or digest(merged_tokenizer.get_vocab()) != base_identity["tokenizer_sha256"]:
        raise SystemExit("Merged tokenizer differs from the pinned base tokenizer")
    report = {"kind": "unreviewed_pilot_merged_base", "unreviewed_pilot": True, "human_reviewed": False,
        "base_model": BASE_MODEL, "base_revision": base_identity["base_revision"], "base_weights": base_identity["base_weights"],
        "adapter": str(adapter), "adapter_sha256": manifest["artifacts"]["adapter_model.safetensors"],
        "adapter_pilot_task": manifest.get("pilot_task"),
        "empathy_adapter": str(resolved[1][0]) if args.empathy_adapter else None,
        "empathy_adapter_sha256": resolved[1][1]["artifacts"]["adapter_model.safetensors"] if args.empathy_adapter else None,
        "combination": {"method": "weighted_delta_task_arithmetic_via_cat", "weights": [args.schema_weight, round(1 - args.schema_weight, 6)]} if args.empathy_adapter else None,
        "merged_weights": weight_digests(args.output),
        "merge_dtype": "bfloat16", "merger": "aligntune.core.merge.peft_merger.PEFTMerger.merge_lora", "versions": package_versions()}
    (args.output / "suraksha_pilot_merge.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: report[k] for k in ("kind", "base_revision", "adapter_sha256", "merged_weights")}, indent=2))


if __name__ == "__main__":
    main()
