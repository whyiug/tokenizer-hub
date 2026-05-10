# tokenizer_hub backend design

## Scope

The first version is a Vercel-deployable Next.js application with a static model snapshot. It does not run scheduled sync jobs and does not download model weights.

## Model catalog

- Source strategy: one-time manual snapshot from OpenRouter rankings/models, Hugging Face downloads/likes, ModelScope, and official provider pages.
- Snapshot file: `src/data/models.ts`.
- Snapshot date: `2026-05-10`.
- Runtime cap: fewer than 300 default models.
- Default UI fields: model name, provider, context, exactness. Source and snapshot details stay out of the user interface.

## Artifact strategy

Only tokenizer artifacts are needed for future server-side expansion:

- `tokenizer.json`
- `tokenizer_config.json`
- `special_tokens_map.json`
- `vocab.json`
- `merges.txt`
- `tokenizer.model`
- `chat_template.jinja`

Model weights are out of scope.

## Runtime strategy

The Vercel-first version runs tokenization in the browser:

- OpenAI-compatible `o200k`, `cl100k`, and `gpt2` families use `js-tiktoken`.
- Other families use a deterministic estimator with explicit `Estimated` status.
- Chat and tools modes render a compact prompt template before tokenization.

Future exact paths can add provider-specific adapters:

- Anthropic: Messages count tokens API.
- Gemini: `models.countTokens`.
- Kimi: token estimate endpoint.
- DeepSeek/Qwen/open models: tokenizer artifacts and chat templates.

## Deployment

Target deployment is Vercel. The current implementation avoids Python, native tokenizer downloads, background queues, and scheduled jobs so the first preview can ship as a standard Next.js application.
