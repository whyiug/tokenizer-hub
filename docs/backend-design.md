# tokenizer_hub backend design

## Scope

tokenizer_hub uses a one-time model snapshot and exact tokenizer artifacts. It does not run scheduled sync jobs and does not download model weights.

The frontend stays minimal: no source labels, snapshot labels, export, or download controls. Operational details live in this document and the validation scripts.

## Model catalog

- Source strategy: one-time manual snapshot from OpenRouter monthly popularity, Hugging Face model activity, and official provider releases.
- Snapshot file: `src/data/models.ts`.
- Backend catalog: generated from the snapshot with `pnpm sync:backend-catalog`.
- Snapshot date: `2026-05-10`.
- Runtime cap: fewer than 300 supported models.
- Current exact model count: 61.

## Artifact strategy

Only tokenizer artifacts are needed. Model weights are out of scope.

- `tokenizer.json`
- `tokenizer_config.json`
- `special_tokens_map.json`
- `vocab.json`
- `merges.txt`
- `tokenizer.model`
- `chat_template.jinja`

Tokenizer assets are keyed by a shared `tokenizerKey`. A tokenizer can be reused only when the remote `tokenizer.json` size is exactly identical for every mapped repository. The local assets live under `backend/tokenizers/<tokenizerKey>/` so they are bundled with the backend and not served as public static files.

Downloads use the Hugging Face mirror when needed:

```bash
HF_ENDPOINT=https://hf-mirror.com pnpm download:tokenizers
```

The download and validation scripts clear proxy environment variables for Hugging Face mirror requests.

## Runtime strategy

The browser does not load tokenizer vocabulary files. It only sends text and model ids to the backend.

- Frontend API base: `NEXT_PUBLIC_TOKENIZER_API_BASE`.
- Local default API base: `http://127.0.0.1:8000`.
- Production default API base: same-origin `/api`.
- Backend service: FastAPI under `backend/app`.
- Health endpoint: `GET /healthz`.
- Tokenization endpoint: `POST /v1/tokenize`.
- Batch endpoint: `POST /v1/tokenize/batch`.

The backend preloads every tokenizer in `backend/catalog.json` during service startup. If any tokenizer cannot be loaded exactly, the service reports it in `/healthz` and the UI shows no token output for that model instead of estimating.

OpenAI-compatible tokenizer families use Python `tiktoken`. Open models use their local Hugging Face `tokenizer.json` artifacts through the native Rust `tokenizers` runtime. Both paths return exact token ids and text segments.

## Validation

Core checks:

```bash
pnpm validate:models
HF_ENDPOINT=https://hf-mirror.com pnpm validate:tokenizer-reuse
pnpm validate:backend-architecture
pnpm validate:backend-api
pnpm validate:exact-ui http://localhost:3001
pnpm validate:all-models-ui http://localhost:3001
```

`validate:backend-api` includes the regression case `五道口纳什` to guard against placeholder ids such as `90000-9004`.

## Deployment

The Vercel deployment exposes the FastAPI backend as a Python Function through `api/index.py` and rewrites `/api/:path*` to that function. This keeps the browser on the same origin and avoids exposing tokenizer assets to the client.

For a heavier production tier, the same FastAPI app can still move to a long-lived Python service. In that case set `NEXT_PUBLIC_TOKENIZER_API_BASE` to the external backend URL before promoting the frontend.
