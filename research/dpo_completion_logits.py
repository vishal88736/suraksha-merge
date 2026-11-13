"""Completion-window logits for TRL 1.7.1 DPO (6 GB laptop memory fix).

TRL's DPO loss runs the LM head over every position (prompt + completion) and
keeps a full-vocabulary logits tensor: for Suraksha's ~1,000-token prompts that
is the 1.39 GiB allocation that ran out of memory. Only completion positions
contribute to the DPO log-probs, so the model is called with
``logits_to_keep=K``. K covers the earliest completion token (minus one, for
the shift), and labels and masks are sliced to the same window. Every
completion log-prob is computed from exactly the same logits as before, so
this is a memory optimization, not a change to the objective. Window logits are
upcast to fp32 before log-softmax so log-prob sums keep full precision. Frozen
non-quantized weights (embedding/tied head, norms) stay in their loaded bf16
instead of peft's fp32 upcast: on the longest pair (1,622 tokens) the step
peak drops from 5.62 GB to 4.82 GB on the RTX 4050. The equivalence
is tested against TRL's own implementation in research/test_dpo_completion_logits.py.
"""
from __future__ import annotations

_NON_MODEL_KEYS = {"completion_mask", "ref_chosen_logps", "ref_rejected_logps"}


def completion_window(completion_mask) -> int:
    """Number of trailing positions whose logits can predict a completion token."""
    columns = completion_mask.sum(dim=0).nonzero()
    if len(columns) == 0:
        return completion_mask.shape[1]
    first = int(columns[0])
    return completion_mask.shape[1] - max(first - 1, 0)


def frozen_to_bf16(model) -> int:
    """Undo peft.prepare_model_for_kbit_training's fp32 upcast of *frozen*
    non-quantized weights (embedding/tied LM head, norms). They are loaded in
    bf16; the upcast costs ~0.6 GB on Qwen2.5-3B and makes logits fp32.
    Trainable LoRA weights stay fp32. Returns the number of tensors recast."""
    import torch
    count = 0
    for param in model.parameters():
        if not param.requires_grad and param.dtype == torch.float32 and param.__class__.__name__ != "Params4bit":
            param.data = param.data.to(torch.bfloat16)
            count += 1
    return count


def _sliced(inputs, keep):
    view = dict(inputs)
    view["input_ids"] = inputs["input_ids"][:, -keep:]
    view["completion_mask"] = inputs["completion_mask"][:, -keep:]
    return view  # attention_mask stays whole: TRL uses it only to count tokens


def install():
    """Patch trl.DPOTrainer in this process. Idempotent; returns a description."""
    from trl.trainer import dpo_trainer as module
    cls = module.DPOTrainer
    if getattr(cls, "_suraksha_completion_logits", False):
        return DESCRIPTION
    original_loss = cls._compute_loss
    original_ref = cls.compute_ref_log_probs
    original_init = cls.__init__

    def __init__(self, *args, **kwargs):
        model = kwargs.get("model", args[0] if args else None)
        if model is not None and not isinstance(model, str):
            RECAST["frozen_tensors_to_bf16"] = frozen_to_bf16(model)
        original_init(self, *args, **kwargs)

    def _compute_loss(self, model, inputs, return_outputs):
        if self.ld_alpha is not None or self.use_liger_kernel:
            return original_loss(self, model, inputs, return_outputs)
        keep = completion_window(inputs["completion_mask"])
        full = {k: v for k, v in inputs.items() if k not in _NON_MODEL_KEYS}
        if not self.precompute_ref_logps:
            raise ValueError("Completion-window DPO requires precompute_ref_log_probs (the reference branch is unpatched)")

        def windowed_model(**_ignored):  # TRL would pass the sliced ids; the forward needs the whole sequence
            outputs = model(**full, use_cache=False, logits_to_keep=keep)
            outputs.logits = outputs.logits.float()  # fp32 log-probs: bf16 sums lose the DPO signal
            return outputs

        return original_loss(self, windowed_model, _sliced(inputs, keep), return_outputs)

    def compute_ref_log_probs(self, inputs):
        if self.ld_alpha is not None:
            return original_ref(self, inputs)
        torch = module.torch
        keep = completion_window(inputs["completion_mask"])
        model_kwargs = {k: v for k, v in inputs.items() if k not in _NON_MODEL_KEYS}
        model_kwargs.update(use_cache=False, logits_to_keep=keep)
        with torch.no_grad(), module.disable_gradient_checkpointing(self.model, self.args.gradient_checkpointing_kwargs):
            if self.ref_model is None:
                if module.is_peft_model(self.model):
                    unwrapped = self.accelerator.unwrap_model(self.model)
                    with module.use_adapter(unwrapped, adapter_name="ref" if "ref" in unwrapped.peft_config else None):
                        ref_outputs = self.model(**model_kwargs)
                else:
                    ref_outputs = self.model(**model_kwargs)
            else:
                ref_outputs = self.ref_model(**model_kwargs)
        window = _sliced(inputs, keep)
        shift_labels = window["input_ids"][..., 1:]
        shift_completion_mask = window["completion_mask"][..., 1:]
        logps = module.selective_log_softmax(ref_outputs.logits[..., :-1, :].float(), shift_labels)
        logps[shift_completion_mask == 0] = 0.0
        return logps.sum(dim=1).chunk(2, dim=0)

    cls._compute_loss = _compute_loss
    cls.compute_ref_log_probs = compute_ref_log_probs
    cls.__init__ = __init__
    cls._suraksha_completion_logits = True
    return DESCRIPTION


RECAST = {}
DESCRIPTION = ("trl.DPOTrainer patched: logits_to_keep over the completion window, fp32 log-probs "
    "(policy and precomputed reference); frozen non-quantized weights kept in bf16")
