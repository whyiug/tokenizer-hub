# Tokenizer Hub

Tokenizer Hub is a compact tokenizer workbench for comparing token usage across modern AI models, with stronger coverage for Chinese model families.

Experience URL:

```text
https://tokenizer.haoqi.xin/
```

The product is intentionally simple: no export/download UI, no model weights, no background sync jobs, and no estimated token counts for unsupported tokenizers.

## Core Features

- Search and switch across a curated model catalog capped below 300 models.
- Compare token counts across selected models.
- Support raw prompt, chat message, tool-call, and comparison workflows.
- Show context usage and remaining context for the selected model.
- Use exact tokenization only. Models without a supported tokenizer are not calculated.
- Preload tokenizer artifacts in the backend so the frontend does not fetch tokenizer vocab files.

## Model Catalog

The frontend model snapshot lives in `src/data/models.ts`; the backend tokenizer registry snapshot lives in `backend/catalog.json`.

The catalog includes representative models from OpenAI, Anthropic, Google, Qwen, DeepSeek, Moonshot/Kimi, Z.ai, MiniMax, Xiaomi, Meta, Mistral, xAI, Baidu, Tencent, ByteDance, Cohere, and others.

The catalog also keeps historically influential deprecated models where they remain useful for research and comparison, such as GPT-3.5, text-davinci, and Llama 2.

Run the catalog guard with:

```bash
pnpm validate:models
```

This checks that the model list stays below the configured size cap and that important requested models remain present.

## Architecture

```text
src/app/page.tsx                    Main client UI and interaction state
src/data/models.ts                  Frontend model catalog snapshot
src/lib/tokenizer.ts                Prompt rendering and display formatting
src/lib/tokenizer-api.ts            Backend tokenizer API client
backend/app/main.py                 FastAPI tokenizer service
backend/app/tokenizer_registry.py   Startup preload and tokenizer dispatch
backend/catalog.json                Backend model-to-tokenizer registry
backend/tokenizers/                 Local tokenizer artifacts
docs/backend-design.md              Backend/tokenizer artifact design notes
scripts/                            Catalog, tokenizer, and UI validation scripts
```

### Frontend

The frontend is built with Next.js App Router, React, Tailwind CSS, and lucide-react icons. The UI is intentionally compact and low-explanation, closer to a utility surface than a marketing page.

### Backend

The backend is a FastAPI service. It preloads all configured tokenizer artifacts at startup, then returns exact token ids and prompt segment mappings to the frontend.

Tokenizer artifacts are stored locally under `backend/tokenizers/`. Hugging Face `tokenizer.json` files are compressed as `tokenizer.json.gz`; Kimi tokenizers use the official `tiktoken.model` plus `tokenizer_config.json`.

Only tokenizer files are stored. Full model weights are never downloaded.

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
pnpm validate:tokenizer-reuse
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
