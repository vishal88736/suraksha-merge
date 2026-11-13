import importlib.util
import types
import unittest


@unittest.skipUnless(importlib.util.find_spec("trl") and importlib.util.find_spec("torch"), "requires the training env (.venv-training)")
class CompletionWindowDPOTests(unittest.TestCase):
    def setUp(self):
        import torch
        from transformers import Qwen2Config, Qwen2ForCausalLM
        torch.manual_seed(0)
        config = Qwen2Config(vocab_size=97, hidden_size=32, intermediate_size=64, num_hidden_layers=2,
            num_attention_heads=4, num_key_value_heads=2, max_position_embeddings=128)
        self.model = Qwen2ForCausalLM(config).eval()
        # One preference pair after TRL's flush_left: shared 7-token prompt,
        # chosen of 6 tokens, rejected of 3 tokens (right padded).
        ids = torch.randint(1, 97, (2, 13))
        attention = torch.ones_like(ids)
        attention[1, 10:] = 0
        completion = torch.zeros_like(ids)
        completion[0, 7:13] = 1
        completion[1, 7:10] = 1
        self.inputs = {"input_ids": ids, "attention_mask": attention, "completion_mask": completion}
        from trl.trainer.dpo_trainer import DPOTrainer
        saved = (DPOTrainer._compute_loss, DPOTrainer.compute_ref_log_probs, DPOTrainer.__init__)
        def restore():
            DPOTrainer._compute_loss, DPOTrainer.compute_ref_log_probs, DPOTrainer.__init__ = saved
            DPOTrainer._suraksha_completion_logits = False
        self.addCleanup(restore)

    def fake_trainer(self):
        return types.SimpleNamespace(ld_alpha=None, ref_model=self.model, model=self.model,
            args=types.SimpleNamespace(gradient_checkpointing_kwargs=None),
            accelerator=types.SimpleNamespace(device="cpu"))

    def test_window_covers_first_completion_token(self):
        from research.dpo_completion_logits import completion_window
        self.assertEqual(completion_window(self.inputs["completion_mask"]), 13 - 6)

    def test_reference_logps_match_trl_full_logits_exactly(self):
        import torch
        from trl.trainer.dpo_trainer import DPOTrainer
        original = DPOTrainer.compute_ref_log_probs
        from research.dpo_completion_logits import install
        install()
        expected = original(self.fake_trainer(), self.inputs)
        actual = DPOTrainer.compute_ref_log_probs(self.fake_trainer(), self.inputs)
        for e, a in zip(expected, actual, strict=True):
            torch.testing.assert_close(a, e, rtol=1e-5, atol=1e-5)

    def test_frozen_weights_return_to_bf16_but_trainable_stay_fp32(self):
        import torch
        from research.dpo_completion_logits import frozen_to_bf16
        model = self.model.float()
        model.model.layers[0].self_attn.q_proj.weight.requires_grad_(True)
        for name, param in model.named_parameters():
            if "layers.0.self_attn.q_proj.weight" not in name: param.requires_grad_(False)
        self.assertGreater(frozen_to_bf16(model), 0)
        self.assertEqual(model.model.layers[0].self_attn.q_proj.weight.dtype, torch.float32)
        self.assertEqual(model.model.embed_tokens.weight.dtype, torch.bfloat16)

    def test_policy_forward_sees_whole_sequence_with_truncated_logits(self):
        from trl.trainer.dpo_trainer import DPOTrainer
        seen = {}

        def fake_loss(self, model, inputs, return_outputs):
            out = model(input_ids=inputs["input_ids"])
            seen.update(logits=out.logits.shape, ids=inputs["input_ids"].shape, mask=inputs["completion_mask"].shape)
            return 0

        DPOTrainer._compute_loss = fake_loss
        from research.dpo_completion_logits import install
        install()
        trainer = types.SimpleNamespace(ld_alpha=None, use_liger_kernel=False, precompute_ref_logps=True)
        DPOTrainer._compute_loss(trainer, self.model, self.inputs, False)
        self.assertEqual(tuple(seen["logits"]), (2, 7, 97))
        self.assertEqual(tuple(seen["ids"]), (2, 7))
        self.assertEqual(tuple(seen["mask"]), (2, 7))


if __name__ == "__main__":
    unittest.main()
