# tokenizer_hub backend design

## Scope

The first version is a Vercel-deployable Next.js application with a static model snapshot. It does not run scheduled sync jobs and does not download model weights.

## Model catalog

- Source strategy: one-time manual snapshot from OpenRouter rankings/models, Hugging Face downloads/likes, ModelScope, and official provider pages.
- Snapshot file: `src/data/models.ts`.
- Snapshot date: `2026-05-10`.
- Runtime cap: fewer than 300 default models.
- Default UI fields: model name, provider, context, and exact tokenizer status. Source and snapshot details stay out of the user interface.

## Artifact strategy

Only tokenizer artifacts are needed. Model weights are out of scope.

- `tokenizer.json`
- `tokenizer_config.json`
- `special_tokens_map.json`
- `vocab.json`
- `merges.txt`
- `tokenizer.model`
- `chat_template.jinja`

Tokenizer assets are keyed by a shared `tokenizerKey`. If a model family uses the same tokenizer files, the app keeps one copy and maps all compatible models to that key. The current local assets live under `public/tokenizers/<tokenizerKey>/`.

## Runtime strategy

The Vercel-first version runs tokenization in the browser:

- OpenAI-compatible `o200k`, `cl100k`, and `gpt2` families use `js-tiktoken`.
- Open models with Hugging Face `tokenizer.json` support use `@huggingface/tokenizers` against local tokenizer assets.
- There is no estimator. If an exact tokenizer is unavailable or fails to load, the UI does not display token output.
- Chat and tools modes render a compact prompt template before tokenization.

Future exact paths can add provider-specific adapters:

- Anthropic: Messages count tokens API.
- Gemini: `models.countTokens`.
- Kimi/open models with custom tokenizer code: local adapter only after the tokenizer can be reproduced exactly in JavaScript.
- Additional open models: tokenizer artifacts and chat templates, deduplicated by tokenizer key.

## Deployment

Target deployment is Vercel. The current implementation avoids Python, native tokenizer downloads, background queues, and scheduled jobs so the first preview can ship as a standard Next.js application.
