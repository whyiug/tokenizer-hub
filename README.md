# tokenizer_hub

`tokenizer_hub` is a minimal tokenizer workbench for comparing token usage across modern AI models, with stronger coverage for both global and Chinese model families.

The first version is designed as a static, Vercel-deployable Next.js app. It does not download model weights, run background sync jobs, or expose export/download flows in the UI.

## Core Features

- Search and switch across a curated model catalog capped below 300 models.
- Compare token counts across selected models.
- Support raw prompt, chat message, tool-call, and comparison workflows.
- Show context usage and remaining context for the selected model.
- Use exact tokenization for OpenAI-compatible tokenizer families where practical.
- Use deterministic estimates for model families without bundled browser-safe tokenizer artifacts.
- Keep provider/source/snapshot details out of the frontend UI and document them in backend design notes.

## Model Catalog

The model snapshot lives in `src/data/models.ts`.

It includes representative models from providers such as OpenAI, Anthropic, Google, Qwen, DeepSeek, Moonshot/Kimi, Z.ai, MiniMax, Xiaomi, Meta, Mistral, xAI, Baidu, Tencent, ByteDance, Cohere, and others.

The catalog also keeps historically influential deprecated models where they remain useful for research and comparison, such as GPT-3.5, text-davinci, and Llama 2.

Run the catalog guard with:

```bash
pnpm validate:models
```

This checks that the model list stays below the configured size cap and that important requested models remain present.

## Architecture

```text
src/app/page.tsx              Main client UI and interaction state
src/data/models.ts            Static model catalog snapshot
src/lib/tokenizer.ts          Prompt rendering, estimates, shared tokenization logic
src/lib/exact-tokenizer.ts    Lazy-loaded js-tiktoken adapters
docs/backend-design.md        Backend and future tokenizer artifact strategy
scripts/validate-model-catalog.mjs
                              Model catalog validation script
```

### Frontend

The app is built with Next.js App Router, React, Tailwind CSS, and lucide-react icons. The UI is intentionally compact and low-explanation, closer to a utility surface than a marketing page.

### Tokenization

The browser runtime uses two paths:

- Exact path: OpenAI tokenizer families are handled with `js-tiktoken`.
- Estimated path: non-OpenAI model families use deterministic heuristics and are marked as estimated.

`js-tiktoken` is loaded lazily through `src/lib/exact-tokenizer.ts` so large tokenizer rank files do not block the first interactive render.

### Backend Strategy

There is no custom backend in v1. The app ships as a static Next.js deployment.

Future exact-tokenizer expansion should add tokenizer artifacts or provider token-count APIs, not full model weights. See `docs/backend-design.md` for details.

## Development

Install dependencies:

```bash
pnpm install
```

Start the local dev server:

```bash
pnpm dev
```

Run checks:

```bash
pnpm validate:models
pnpm lint
pnpm build
```

## Deployment

The project is deployed on Vercel as a standard Next.js app.

Production URL:

```text
https://tokenizer-hub.vercel.app
```
