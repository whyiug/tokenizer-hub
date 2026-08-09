# Tokenizer Hub backend design

## Scope and invariants

Tokenizer Hub v0.2.0 is a curated `2026-08-09` snapshot with 88 catalog entries. It never downloads model weights, estimates token IDs, executes Hugging Face remote code, or sends prompt content to model providers. Unsupported modes fail closed.

Accuracy is capability-specific:

- Raw encodes submitted text with a verified local tokenizer.
- Chat serializes ordered messages with a verified formatter, then tokenizes that exact text.
- Tools adds verified tool-definition serialization.

The catalog contains 86 exact Raw entries. Two unreleased DeepSeek preview identifiers have all support flags disabled. Qwen3 8B is the only v0.2.0 model advertising Chat and Tools because it is backed by a pinned official template and golden fixtures.

## Catalog and evidence

- UI snapshot: `src/data/models.ts`.
- Generated backend snapshot: `backend/catalog.json` via `pnpm sync:backend-catalog`.
- Evidence: `data/model-evidence.json` via `pnpm sync:model-evidence`.
- Snapshot date: `2026-08-09`.
- Lifecycle values: `active`, `preview`, and `legacy`.
- Independent support flags: `raw`, `chat`, and `tools`.

Evidence records official model/context URLs, tokenizer type, source repository, fixed 40-character revision, source-file SHA-256, verification date, and renderer evidence when applicable. Llama 4 uses a public byte-identical tokenizer mirror because the official repositories are gated; both official Git blob identities and public mirror revisions are recorded and remotely verified.

## Artifact identity and startup

Tokenizer definitions live in `scripts/tokenizer-assets.mjs`. Local files live in `backend/tokenizers/<asset>/`, and `backend/tokenizers/manifest.json` records stored and uncompressed source hashes. `tokenizer.json` is gzip-compressed; Kimi uses `tiktoken.model` plus `tokenizer_config.json`.

Reuse is allowed only when the runtime identity files have equal content hashes at pinned revisions:

- Hugging Face tokenizer: `tokenizer.json` SHA-256.
- Hugging Face tiktoken tokenizer: `tiktoken.model` and `tokenizer_config.json` SHA-256.

File size is diagnostic only. The registry verifies every checked-in file before constructing any tokenizer. A missing manifest, missing file, or hash mismatch leaves startup unready. `/healthz` separates `checksumErrors`, `tokenizerErrors`, and `rendererErrors`.

Downloads use a temporary source file, validate the pinned source, compress when applicable, and atomically replace the target. New pinned assets require the explicit bootstrap flag once; the generated manifest and remote validator then become authoritative:

```bash
pnpm download:tokenizers -- --bootstrap-new-assets
pnpm sync:tokenizer-manifest
pnpm validate:tokenizer-reuse
```

## Structured request flow

The browser sends a discriminated request to FastAPI:

```json
{"modelId":"openai/gpt-5.6-sol","mode":"raw","text":"hello"}
```

```json
{"modelId":"qwen/qwen3-8b","mode":"chat","messages":[{"role":"user","content":"hello"}]}
```

Tools mode adds a `tools` array. Contradictory payloads are rejected rather than inferred. `PromptRendererRegistry` checks the model's support flag and uses only reviewed local renderers. The response includes `serializedText`, `mode`, tokenizer identity, token IDs, count, and source-aligned segments. The frontend preview displays `serializedText`; it is not authoritative for serialization.

Stable error codes distinguish `unknown_model`, `unsupported_mode`, `renderer_failed`, `tokenizer_unavailable`, and `registry_not_ready`. Batch requests return typed unavailable rows without aborting successful models.

## Runtime and deployment

- Local API base: `http://127.0.0.1:8000`.
- Production API base: same-origin `/api`.
- Health: `GET /healthz`.
- Single request: `POST /v1/tokenize`.
- Batch request: `POST /v1/tokenize/batch`.
- Vercel entry point: `api/index.py`.

The checked-in tokenizer directory is roughly 73 MiB in the working tree; v0.2.0 adds about 25 MiB of stored assets. If the Python Function bundle exceeds a hosting limit, the unchanged FastAPI app can move to a long-lived service and the frontend can set `NEXT_PUBLIC_TOKENIZER_API_BASE`.

## Verification

```bash
pnpm validate:models
pnpm validate:evidence
pnpm validate:tokenizer-reuse
pnpm validate:backend-architecture
backend/.venv/bin/python -m unittest discover -s backend/tests -v
pnpm validate:segments
pnpm validate:backend-api http://127.0.0.1:8000
pnpm validate:mode-ui http://localhost:3001
pnpm build
```

The multilingual Raw fixtures include Chinese, emoji, a combining character, whitespace, and special-token-looking text. Prompt-rendering fixtures cover the official Qwen3 Chat and Tools serialization.
