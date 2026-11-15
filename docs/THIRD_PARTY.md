# Credits and third-party assets

SurakshaDesk builds on models, datasets and tools made by others. This page says what each one is, where it comes from, under which licence, and what role it played, so that nothing is claimed that we did not do. Licence names are those recorded in `data/public_sources.lock.json` or on the upstream pages; check the upstream page before redistributing.

## Models from Hugging Face

| Model | Source | Role | Notes |
| :--- | :--- | :--- | :--- |
| **Qwen2.5-3B-Instruct** (Alibaba Qwen team) | [`Qwen/Qwen2.5-3B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct), revision `aa8e72537993ba99e69dfaafa59ed015b17504d1` | The **base model** we fine-tuned. Our two models, `merged-schema-sft-004` and `merged-dual-sft-004`, are this model plus our LoRA training | Licence: see the model card. Any redistribution of our merged weights must follow it (the 3B size may carry restrictions, so check before publishing) |
| **IndicTrans2 en→indic 1B** (AI4Bharat) | [`ai4bharat/indictrans2-en-indic-1B`](https://huggingface.co/ai4bharat/indictrans2-en-indic-1B) | Machine-translated the interface and reply templates into 21 languages | Gated model (terms accepted on Hugging Face); MIT per the AI4Bharat repository |
| **IndicTrans2 indic→en 1B** (AI4Bharat) | [`ai4bharat/indictrans2-indic-en-1B`](https://huggingface.co/ai4bharat/indictrans2-indic-en-1B) | Back-translated every string to check that negations and numbers survived | Same terms as above |

## Datasets

All five were downloaded at pinned revisions (`data/public_sources.lock.json`). Only one supplied training cases; the rest were inspected, or kept apart as external benchmarks.

| Dataset | Host and licence | Role in this project |
| :--- | :--- | :--- |
| **CuCom banking** (vakyansh) | [GitHub](https://github.com/vakyansh/cucom), Apache 2.0 | **Source of 259 training cases** (publisher-declared synthetic support conversations), curated, reviewed and re-labelled by us |
| **IndicJevBench** | [Hugging Face](https://huggingface.co/datasets/cmul8-hf/IndicJevBench), CC BY 4.0 | Frozen **external benchmark only** (11,480 records), with original task labels. Not used for training |
| **Chakravyuh-Bench** | [Hugging Face Space](https://huggingface.co/spaces/ujjwalpardeshi/chakravyuh), CC BY 4.0 (dataset card) | 175 reconstructed scam scenarios reserved as an **external benchmark**. Not used for training or model benchmarking |
| **BANKING77** (PolyAI) | [Hugging Face](https://huggingface.co/datasets/PolyAI/banking77), CC BY 4.0 | Inspected only: no explicit UPI dispute evidence, so zero examples used |
| **Indian Scam/Ham** (anmolshrivastav) | [Hugging Face](https://huggingface.co/datasets/anmolshrivastav/scam-ham-india), Apache 2.0 | Inspected and **excluded**: SMS and promotion text is not evidence of a disputed UPI transaction |

The rest of the 810 training cases were written by this project (343 synthetic cases from templates, and 213 hand-written varied-wording cases) and reviewed by us. Source licences stay attached to every derived record; this project does not relicense third-party content. Details in [DATA_CURATION.md](DATA_CURATION.md).

## Toolkits (Lexsi-Labs, GitHub)

Installed from pinned commits (see the `requirements-*.txt` files).

| Toolkit | Version / commit | Role |
| :--- | :--- | :--- |
| [**CuratorKIT**](https://github.com/Lexsi-Labs/CuratorKIT) | 0.1.21, `cee1aed` | Data curation: cleaning, deduplication, schema and policy gates, scenario-grouped splits |
| [**AlignTune**](https://github.com/Lexsi-Labs/aligntune) | `9a80753` | Training: QLoRA supervised fine-tuning, plus the pilot GRPO, DPO and merge experiments |
| [**AuditKIT**](https://github.com/Lexsi-Labs/AuditKIT) | 1.1.6, `9da5838` | Evaluation: schema validity, all-fields match, unsafe-guarantee scoring, paired bootstrap |

## Policy sources

RBI customer-liability circular (2017), RBI turnaround-time rules for failed transactions (2019), the RBI Ombudsman scheme (2026), NPCI UPI dispute-redressal guidance and the I4C / 1930 cybercrime reporting channels. Primary sources, with review dates, are listed in `lib/policy.ts` and shown in the app's Policy library. The category names are an internal taxonomy, not an official contract.

## Other open-source components

Hugging Face Transformers, PEFT, TRL and bitsandbytes (training and serving); the Qwen chat template; Tesseract.js (on-device screenshot reading, Apache 2.0); Noto fonts (SIL Open Font License); Next/vinext, React and Cloudflare Workers (the web app); sacreBLEU (translation checks).

## What is ours

The rules engine and policy encoding, the privacy masking, the human-review process and decisions, the template-based synthetic cases and the 213 varied-wording cases, the checks that flag a model's answer, the web app, the two fine-tuned adapters and merged models, and the evaluation scripts and results.
