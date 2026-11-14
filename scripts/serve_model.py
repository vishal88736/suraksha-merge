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


def parse_request(body: bytes, with_options: bool = False):
    """Validate the request; returns (message, context), or with_options
    (message, context, task) where task is "schema" (the JSON payload) or
    "reply" (only the customer reply, asked for once the payload was used)."""
    if len(body) > MAX_BODY_BYTES:
        raise ValueError("payload_too_large")
    data = json.loads(body)
    if not isinstance(data, dict) or set(data) - {"message", "context", "task"}:
        raise ValueError("invalid_request")
    if data.get("task", "schema") not in ("schema", "reply"):
        raise ValueError("invalid_request")
    message, context = data.get("message"), data.get("context", {})
    if not isinstance(message, str) or not message.strip() or len(message) > MAX_MESSAGE_CHARS:
        raise ValueError("invalid_message")
    if not isinstance(context, dict) or set(context) - CONTEXT_KEYS:
        raise ValueError("invalid_context")
    if any(not (value is None or isinstance(value, (str, int)) and not isinstance(value, bool)) for value in context.values()):
        raise ValueError("invalid_context")
    return (message, context, data.get("task", "schema")) if with_options else (message, context)


def schema_prompt(message: str, context: dict) -> str:
    """Identical to phase1_curatorkit_pipeline.py's RLVR/SFT schema prompt."""
    return prompt_for(message, context, "schema")


def reply_prompt(message: str, context: dict) -> str:
    """Identical to the reply records in the curated SFT data (task "reply")."""
    return prompt_for(message, context, "reply")


def request_deadline(header: str | None, queue_timeout: float) -> float:
    """Seconds this request may wait for the GPU: the caller's budget
    (x-suraksha-deadline-ms) if it sent one, never more than queue_timeout."""
    try:
        budget = int(header) / 1000 if header is not None else queue_timeout
    except ValueError:
        budget = queue_timeout
    return max(0.0, min(budget, queue_timeout))


def make_handler(generate, info: dict, token: str | None, max_queue: int = 2, queue_timeout: float = 35.0, max_reply_tokens: int = 384):
    """generate(prompt) -> (text, input_tokens, output_tokens). Calls are serialized."""
    lock = threading.Lock()
    admission = threading.Lock()
    queue = {"waiting": 0}

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
                message, context, task = parse_request(self.rfile.read(length), with_options=True)
            except (ValueError, json.JSONDecodeError) as error:
                code = str(error) if str(error) in {"payload_too_large", "invalid_request", "invalid_message", "invalid_context"} else "invalid_json"
                return self._send(413 if code == "payload_too_large" else 400, {"error": code})
            started = time.perf_counter()
            deadline = request_deadline(self.headers.get("x-suraksha-deadline-ms"), queue_timeout)
            # Bounded queue: generation is serialised on one GPU, so excess
            # requests are refused at once instead of growing a backlog.
            with admission:
                if queue["waiting"] >= max_queue:
                    return self._send(503, {"error": "busy"})
                queue["waiting"] += 1
            try:
                acquired = lock.acquire(timeout=deadline)
            finally:
                with admission:
                    queue["waiting"] -= 1
            if not acquired:
                return self._send(503, {"error": "busy"})
            try:
                # The caller has given up: do not spend GPU time on its request.
                if time.perf_counter() - started >= deadline:
                    return self._send(503, {"error": "busy"})
                # One generation per request: the caller asks for the reply
                # separately, and only after the payload passed its gates.
                if task == "reply":
                    reply_text, input_tokens, output_tokens = generate(reply_prompt(message, context), max_new_tokens=max_reply_tokens)
                    text = ""
                else:
                    text, input_tokens, output_tokens = generate(schema_prompt(message, context))
                    reply_text = None
            except Exception:  # do not echo internals or inputs
                return self._send(500, {"error": "generation_failed"})
            finally:
                lock.release()
            self._send(200, {"raw": text, "reply": reply_text, "latency_ms": round((time.perf_counter() - started) * 1000, 1),
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
        # An SFT adapter merged into the base: a labelled pilot, or trained on
        # human-reviewed data (scripts/merge_pilot_adapter.py records which).
        merge = json.loads(merge_report.read_text())
        reviewed = merge.get("kind") == "reviewed_merged_base" and merge.get("human_reviewed") is True and not merge.get("unreviewed_pilot")
        if not reviewed and not args.allow_pilot_adapter:
            raise SystemExit("This is a merged unreviewed-pilot model: pass --allow-pilot-adapter to serve it as a labelled pilot.")
        if merge.get("merged_weights") != base_identity["base_weights"]:
            raise SystemExit("Merged weights differ from their merge record.")
        pilot = not reviewed
        display_model = f"{merge['base_model']} + merged {'reviewed' if reviewed else 'pilot'} SFT"
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

    def generate(prompt, max_new_tokens=None):
        rendered = tokenizer.apply_chat_template([{"role": "user", "content": prompt}], tokenize=False, add_generation_prompt=True)
        encoded = tokenizer(rendered, return_tensors="pt").to(model.device)
        count = encoded["input_ids"].shape[1]
        with torch.inference_mode():
            out = model.generate(**encoded, do_sample=False, max_new_tokens=max_new_tokens or args.max_new_tokens, pad_token_id=tokenizer.eos_token_id)
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
    parser.add_argument("--max-queue", type=int, default=2, help="requests allowed to wait for the GPU; more get 503 busy")
    parser.add_argument("--queue-timeout", type=float, default=35.0, help="longest a request may wait for the GPU, in seconds")
    parser.add_argument("--max-reply-tokens", type=int, default=384, help="length limit for a generated customer reply")
    args = parser.parse_args()
    if args.host not in LOOPBACK:
        parser.error("The model server binds to loopback only.")
    if not 1 <= args.max_new_tokens <= 1024:
        parser.error("--max-new-tokens must be between 1 and 1024")
    generate, info = load_model(args)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(generate, info, os.environ.get("SURAKSHA_MODEL_TOKEN") or None, args.max_queue, args.queue_timeout, args.max_reply_tokens))
    print(json.dumps({"listening": f"http://{args.host}:{args.port}", **info}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
