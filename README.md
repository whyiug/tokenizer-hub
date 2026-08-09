# Tokenizer Hub

Language: English | [简体中文](README.zh-CN.md)

Tokenizer Hub is a compact tokenizer workbench for comparing token usage across modern AI models, with stronger coverage for Chinese model families.

Experience URL:

```text
https://tokenizer.haoqi.xin/
```

![Tokenizer Hub preview](docs/assets/tokenizer-hub-preview.png)

The product is intentionally simple: no export/download UI, no model weights, no background sync jobs, no remote-provider credentials, and no estimated token counts.

## Core Features

- Search and switch across a curated model catalog capped below 300 models.
- Compare token counts across selected models that support the active input mode.
- Support Raw, Chat, Tools, and Compare workflows with capability-specific accuracy claims.
- Show context usage and remaining context for the selected model.
- Show `Exact Raw`, `Exact Chat`, or `Exact Tools` only when that specific local path is verified. Unsupported modes remain visible as unavailable.
- Preload tokenizer artifacts in the backend so the frontend does not fetch tokenizer vocab files.

## Model Catalog

The frontend model snapshot lives in `src/data/models.ts`; the backend tokenizer registry snapshot lives in `backend/catalog.json`.

The v0.2.0 snapshot is dated `2026-08-09` and contains 88 entries: 86 have exact local Raw tokenization, and the two unreleased DeepSeek preview identifiers remain searchable but unavailable. Providers represented in the snapshot are OpenAI, Google, Qwen, DeepSeek, Moonshot/Kimi, Z.ai, MiniMax, Xiaomi, Meta, and Mistral AI.

The current additions include GPT-5.6 Sol/Terra/Luna, DeepSeek V4 Flash 0731, GLM-5.2, Kimi K3 and K2.7 Code, MiniMax M3, five Gemma 4 instruction variants, Llama 4 Scout/Maverick, and current Mistral Small/Medium representatives.

The catalog also keeps historically influential deprecated models where they remain useful for research and comparison, such as GPT-3.5, text-davinci, and Llama 2.

Run the catalog guard with:

```bash
pnpm validate:models
```

This checks the exact 88-entry snapshot, lifecycle metadata, mode capabilities, assets, defaults, and required model IDs. `pnpm validate:evidence` independently checks official-source URLs, pinned revisions, artifact SHA-256 values, and renderer evidence.

## Architecture

```text
src/app/page.tsx                    Main client UI and interaction state
src/data/models.ts                  Frontend model catalog snapshot
src/lib/tokenizer.ts                Token-segment presentation formatting
src/lib/tokenizer-api.ts            Backend tokenizer API client
backend/app/main.py                 FastAPI tokenizer service
backend/app/tokenizer_registry.py   Startup preload and tokenizer dispatch
backend/app/prompt_renderer.py      Reviewed structured-prompt renderer registry
backend/catalog.json                Backend model-to-tokenizer registry
backend/tokenizers/                 Local tokenizer artifacts
data/model-evidence.json            Official-source and checksum evidence
docs/backend-design.md              Backend/tokenizer artifact design notes
scripts/                            Catalog, tokenizer, and UI validation scripts
```

### Frontend

The frontend is built with Next.js App Router, React, Tailwind CSS, and lucide-react icons. The UI is intentionally compact and low-explanation, closer to a utility surface than a marketing page.

### Backend

The backend is a FastAPI service. It verifies the tokenizer manifest, preloads configured artifacts, renders supported structured requests, and returns the authoritative serialized text, exact token IDs, and segment mappings.

Raw sends text. Chat sends ordered messages. Tools sends ordered messages plus tool definitions. The browser never invents the authoritative chat/tool serialization. v0.2.0 advertises exact Chat and Tools only for the fixture-backed Qwen3 8B renderer; other models remain Raw-only until an official formatter is reviewed and tested.

Tokenizer artifacts are stored locally under `backend/tokenizers/`. Hugging Face `tokenizer.json` files are compressed as `tokenizer.json.gz`; Kimi tokenizers use the official `tiktoken.model` plus `tokenizer_config.json`.

Only tokenizer and reviewed prompt-template files are stored. Full model weights are never downloaded. Every stored artifact is pinned to a source revision and verified by SHA-256 at startup. Input is not sent to model providers; API-only token-count or token-ID services are intentionally out of scope.

## Development

Install dependencies:

```bash
pnpm install
```

Start the frontend:

```bash
pnpm dev
```

Start the backend:

```bash
pnpm backend
```

Run checks:

```bash
pnpm validate:models
pnpm validate:evidence
pnpm validate:tokenizer-reuse
pnpm validate:backend-architecture
backend/.venv/bin/python -m unittest discover -s backend/tests -v
pnpm validate:segments
pnpm lint
pnpm build
```

## Deployment

The frontend and backend are deployed through Vercel.

Production URL:

```text
https://tokenizer.haoqi.xin/
```
