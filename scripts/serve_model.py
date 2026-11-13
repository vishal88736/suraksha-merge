"""Loopback-only inference server for the website's model-first triage.

Serves the pinned Qwen base (NF4 on small GPUs), optionally with a verified
LoRA adapter, using the exact schema prompt used for training. It returns the
model's raw text; the website validates it and falls back to rules. No repairs
are applied here, and customer messages are never logged.

  .venv-training/bin/python scripts/serve_model.py            # base model
  .venv-training/bin/python scripts/serve_model.py --adapter checkpoints/schema
"""
from __future__ import annotations
import argparse
import hmac
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from research.common import prompt_for

PINNED_REVISION = "aa8e72537993ba99e69dfaafa59ed015b17504d1"
LOOPBACK = {"127.0.0.1", "::1", "localhost"}
MAX_BODY_BYTES = 64 * 1024
MAX_MESSAGE_CHARS = 12_000
CONTEXT_KEYS = {"reporting_delay_working_days", "elapsed_calendar_days", "responsibility",
    "account_tier", "language", "transaction_date"}


def parse_request(body: bytes):
    """Validate the request; returns (message, context) or raises ValueError."""
    if len(body) > MAX_BODY_BYTES:
        raise ValueError("payload_too_large")
    data = json.loads(body)
    if not isinstance(data, dict) or set(data) - {"message", "context"}:
        raise ValueError("invalid_request")
    message, context = data.get("message"), data.get("context", {})
    if not isinstance(message, str) or not message.strip() or len(message) > MAX_MESSAGE_CHARS:
        raise ValueError("invalid_message")
    if not isinstance(context, dict) or set(context) - CONTEXT_KEYS:
        raise ValueError("invalid_context")
    if any(not (value is None or isinstance(value, (str, int)) and not isinstance(value, bool)) for value in context.values()):
        raise ValueError("invalid_context")
    return message, context


def schema_prompt(message: str, context: dict) -> str:
    """Identical to phase1_curatorkit_pipeline.py's RLVR/SFT schema prompt."""
    return prompt_for(message, context, "schema")


def make_handler(generate, info: dict, token: str | None):
    """generate(prompt) -> (text, input_tokens, output_tokens). Calls are serialized."""
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        server_version = "suraksha-model/1"

        def log_message(self, fmt, *args):  # never log bodies or query strings
            sys.stderr.write(f"{self.command} {self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}\n")

        def _send(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("cache-control", "no-store")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _authorized(self):
            if not token:
                return True
            supplied = self.headers.get("authorization", "")
            return hmac.compare_digest(supplied.encode(), f"Bearer {token}".encode())

        def do_GET(self):
            if not self._authorized():
                return self._send(401, {"error": "unauthorized"})
            if self.path != "/health":
                return self._send(404, {"error": "not_found"})
            self._send(200, {"status": "ok", "model": info})

        def do_POST(self):
            if not self._authorized():
                return self._send(401, {"error": "unauthorized"})
            if self.path != "/v1/triage":
                return self._send(404, {"error": "not_found"})
            if (self.headers.get("content-type") or "").split(";")[0].strip() != "application/json":
                return self._send(415, {"error": "unsupported_media_type"})
            try:
                length = int(self.headers.get("content-length") or 0)
                if length > MAX_BODY_BYTES:
                    raise ValueError("payload_too_large")
                message, context = parse_request(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError) as error:
                code = str(error) if str(error) in {"payload_too_large", "invalid_request", "invalid_message", "invalid_context"} else "invalid_json"
                return self._send(413 if code == "payload_too_large" else 400, {"error": code})
            started = time.perf_counter()
            try:
                with lock:
                    text, input_tokens, output_tokens = generate(schema_prompt(message, context))
            except Exception:  # do not echo internals or inputs
                return self._send(500, {"error": "generation_failed"})
            self._send(200, {"raw": text, "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                "input_tokens": input_tokens, "output_tokens": output_tokens,
                "model": {k: info[k] for k in ("base_model", "base_revision", "adapter", "adapter_sha256", "quantization", "unreviewed_pilot")}})

    return Handler


def load_model(args):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from phase2_aligntune_train_and_merge import identity, materialize_base, pin_materialized_weights
    from research.artifacts import resolve_adapter
    if not torch.cuda.is_available():
        raise SystemExit("A working CUDA GPU is required to serve the model.")
    base_identity = identity(args.model, args.revision)
    model_path = materialize_base(args.model, base_identity)
    base_identity = pin_materialized_weights(base_identity, model_path)
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=False)
    kwargs = dict(device_map={"": 0}, trust_remote_code=False, attn_implementation="sdpa")
    if args.quantization == "nf4":
        compute = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=compute)
    else:
        kwargs["dtype"] = torch.bfloat16
    model = AutoModelForCausalLM.from_pretrained(model_path, **kwargs)
    adapter_path, adapter_sha, pilot = None, None, False
    display_model, display_revision = args.model, base_identity["base_revision"]
    merge_report = Path(args.model) / "suraksha_pilot_merge.json"
    if Path(args.model).is_dir() and merge_report.is_file():
        # A pilot SFT adapter merged into the base: fine-tuned, unreviewed.
        merge = json.loads(merge_report.read_text())
        if not args.allow_pilot_adapter:
            raise SystemExit("This is a merged unreviewed-pilot model: pass --allow-pilot-adapter to serve it as a labelled pilot.")
        if merge.get("merged_weights") != base_identity["base_weights"]:
            raise SystemExit("Merged pilot weights differ from their merge record.")
        pilot = True
        display_model = f"{merge['base_model']} + merged pilot SFT"
        display_revision = merge["base_revision"]
        adapter_path, adapter_sha = merge["adapter"], merge["adapter_sha256"]
    if args.adapter:
        from peft import PeftModel
        adapter, manifest = resolve_adapter(args.adapter)
        recorded = manifest.get("identity") or {}
        for key in ("base_revision", "base_weights", "tokenizer_sha256"):
            if recorded.get(key) != base_identity.get(key):
                raise SystemExit(f"Adapter was trained on a different base ({key} mismatch).")
        if (manifest.get("training_outcome") or {}).get("parameters_updated") is not True:
            raise SystemExit("Adapter has no verified optimizer update; refusing to serve it as fine-tuned.")
        adapter_pilot = bool(manifest.get("unreviewed_pilot"))
        if adapter_pilot and not args.allow_pilot_adapter:
            raise SystemExit("Unreviewed-pilot adapter: pass --allow-pilot-adapter to serve it as a labelled pilot.")
        pilot = pilot or adapter_pilot  # a pilot merged base keeps the label
        if not adapter_pilot and (manifest.get("smoke_test_only") or manifest.get("bootstrap_smoke_run")) and not args.allow_smoke_adapter:
            raise SystemExit("Smoke-test adapters are not for serving; pass --allow-smoke-adapter for a labelled experiment.")
        model = PeftModel.from_pretrained(model, str(adapter))
        adapter_path, adapter_sha = str(adapter), manifest["artifacts"]["adapter_model.safetensors"]
    model.eval()
    info = {"base_model": display_model, "base_revision": display_revision,
        "adapter": adapter_path, "adapter_sha256": adapter_sha, "quantization": args.quantization,
        "fine_tuned": adapter_path is not None, "unreviewed_pilot": pilot, "max_new_tokens": args.max_new_tokens, "do_sample": False}

    def generate(prompt):
        rendered = tokenizer.apply_chat_template([{"role": "user", "content": prompt}], tokenize=False, add_generation_prompt=True)
        encoded = tokenizer(rendered, return_tensors="pt").to(model.device)
        count = encoded["input_ids"].shape[1]
        with torch.inference_mode():
            out = model.generate(**encoded, do_sample=False, max_new_tokens=args.max_new_tokens, pad_token_id=tokenizer.eos_token_id)
        tokens = out[0, count:]
        return tokenizer.decode(tokens, skip_special_tokens=True), int(count), int(len(tokens))

    return generate, info


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default="Qwen/Qwen2.5-3B-Instruct")
    parser.add_argument("--revision", default=PINNED_REVISION)
    parser.add_argument("--adapter", type=Path)
    parser.add_argument("--allow-smoke-adapter", action="store_true")
    parser.add_argument("--allow-pilot-adapter", action="store_true", help="Serve an unreviewed-pilot adapter, labelled as such")
    parser.add_argument("--quantization", choices=["nf4", "bf16"], default="nf4")
    parser.add_argument("--max-new-tokens", type=int, default=256)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if args.host not in LOOPBACK:
        parser.error("The model server binds to loopback only.")
    if not 1 <= args.max_new_tokens <= 1024:
        parser.error("--max-new-tokens must be between 1 and 1024")
    generate, info = load_model(args)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(generate, info, os.environ.get("SURAKSHA_MODEL_TOKEN") or None))
    print(json.dumps({"listening": f"http://{args.host}:{args.port}", **info}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
