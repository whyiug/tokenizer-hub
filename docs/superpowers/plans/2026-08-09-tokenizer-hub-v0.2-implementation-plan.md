# tokenizer_hub v0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship tokenizer_hub v0.2.0 with an evidence-backed 88-model catalog, mode-specific exactness, structured prompt tokenization, and no remote or estimated token counts.

**Architecture:** Keep the browser as a thin structured-request client. A FastAPI tokenizer registry remains authoritative for token IDs, while a new renderer registry serializes Chat and Tools requests from checked-in official templates or reviewed dedicated encoders. Catalog support flags, evidence, artifact checksums, renderer fixtures, and startup health must agree before a mode can be advertised as exact.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript 5, FastAPI, Pydantic, Python `tiktoken`, Hugging Face `tokenizers`, sandboxed Jinja2, Node validation scripts, Playwright.

---

## Success criteria

- The checked-in snapshot contains exactly 88 canonical model entries dated `2026-08-09`.
- Every model declares `active`, `preview`, or `legacy`, plus independent Raw, Chat, and Tools support.
- Every exact Raw mode resolves to a local tokenizer whose source revision and SHA-256 are recorded.
- Every exact Chat or Tools mode resolves to a local renderer and a passing official-format fixture.
- The API receives structured content for Chat and Tools; the browser never supplies the authoritative serialized prompt.
- Unknown models, unsupported modes, renderer failures, tokenizer failures, and checksum startup failures remain distinguishable.
- Unsupported modes stay visible but disabled, and Compare excludes them without silently estimating.
- Lint, production build, catalog validation, backend tests, and Playwright regressions pass.

## Task 1: Lock the catalog contract with failing validations

**Files:**

- Modify: `src/data/models.ts`
- Create: `data/model-evidence.json`
- Create: `scripts/validate-model-evidence.mjs`
- Modify: `scripts/validate-model-catalog.mjs`
- Modify: `package.json`

- [x] Add a failing catalog validation for the v0.2 schema and exact count.

The validator must require these fields on each entry:

```ts
type ModelLifecycle = "active" | "preview" | "legacy";
type ModeSupport = { raw: boolean; chat: boolean; tools: boolean };

type ModelSpec = {
  id: string;
  lifecycle: ModelLifecycle;
  support: ModeSupport;
  rendererKey?: string;
};
```

It must also reject an exact Chat/Tools declaration without a `rendererKey`, invalid defaults, duplicate IDs, a model count other than 88, and a snapshot date other than `2026-08-09`.

- [x] Add a failing evidence validation.

`data/model-evidence.json` must use this stable shape:

```json
{
  "snapshotDate": "2026-08-09",
  "models": {
    "provider/model-id": {
      "modelUrl": "https://...",
      "contextUrl": "https://...",
      "tokenizer": {
        "repo": "owner/repo",
        "revision": "40-hex-commit",
        "files": [{ "path": "tokenizer.json", "sha256": "64-hex" }]
      },
      "renderer": null,
      "verifiedAt": "2026-08-09"
    }
  }
}
```

For tiktoken families, record the official encoding source and installed package version instead of inventing a Hugging Face repository. The script must require one evidence entry per model and validate URLs, revisions, SHA-256 values, and support/renderer consistency.

- [x] Run the new validations and confirm they fail for the old 71-model schema.

Run: `pnpm validate:models && pnpm validate:evidence`

Expected: non-zero exit with actionable schema/count/evidence messages.

- [x] Implement the new TypeScript types and extend the `model(...)` helper without changing catalog behavior yet.

Use explicit lifecycle and support arguments at call sites; do not infer exactness from provider or tokenizer family.

- [x] Add `validate:evidence` to `package.json`, rerun the tests, and commit the contract scaffold.

Run: `pnpm validate:models; pnpm validate:evidence`

Expected: catalog still fails only on the deliberate 88-model requirement; evidence reports missing records rather than crashing.

Commit: `git commit -m "test: define v0.2 catalog evidence contract"`

## Task 2: Make tokenizer assets content-addressed and fail closed

**Files:**

- Create: `backend/tokenizers/manifest.json`
- Modify: `scripts/tokenizer-assets.mjs`
- Modify: `scripts/download-tokenizer-assets.mjs`
- Modify: `scripts/validate-tokenizer-reuse.mjs`
- Modify: `backend/app/tokenizer_registry.py`
- Create: `backend/tests/test_tokenizer_manifest.py`
- Modify: `backend/requirements.txt`
- Modify: `requirements.txt`

- [x] Write failing Python tests for missing files, wrong hashes, and valid shared assets.

```python
def test_preload_rejects_wrong_sha256(tmp_path): ...
def test_preload_rejects_missing_manifest_entry(tmp_path): ...
def test_identical_sha256_allows_tokenizer_reuse(tmp_path): ...
```

Run: `backend/.venv/bin/python -m unittest backend.tests.test_tokenizer_manifest -v`

Expected: failures because the registry does not verify a manifest.

- [x] Generate a manifest entry for every currently checked-in tokenizer file.

Each file record contains its relative path, byte size for diagnostics, SHA-256 for identity, official repository, and pinned commit revision. Do not accept size equality as proof of reuse.

- [x] Update downloads to write to a temporary file, verify SHA-256, then atomically replace the destination.

- [x] Update reuse validation to compare remote content hashes or pinned manifest hashes. Keep sizes only in error messages.

- [x] Verify every manifest file during registry preload before constructing tokenizer objects.

Health must expose checksum errors separately from tokenizer-load errors and leave `ready: false` after any startup integrity failure.

- [x] Run tests and current-catalog validations.

Run:

```bash
backend/.venv/bin/python -m unittest backend.tests.test_tokenizer_manifest -v
pnpm validate:tokenizer-reuse
pnpm validate:models
```

Expected: asset integrity, reuse, registry, and lint checks pass; `validate:models` retains the deliberate 71-versus-88 failure until Task 5.

Commit: `git commit -m "feat: verify tokenizer assets by sha256"`

## Task 3: Introduce the structured tokenization API

**Files:**

- Modify: `backend/app/main.py`
- Modify: `backend/app/tokenizer_registry.py`
- Create: `backend/app/prompt_renderer.py`
- Create: `backend/tests/test_structured_api.py`
- Modify: `src/lib/tokenizer-api.ts`
- Modify: `scripts/validate-backend-api.mjs`

- [x] Write failing API tests for Raw, Chat, Tools, malformed requests, unknown models, and unsupported modes.

Use a request contract equivalent to:

```json
{
  "modelId": "qwen/qwen3-8b",
  "mode": "chat",
  "messages": [{ "role": "user", "content": "你好" }],
  "tools": []
}
```

Raw requests contain `text`; Chat/Tools requests contain ordered `messages`; Tools additionally contains tool definitions. Reject contradictory payloads instead of guessing.

- [x] Add typed backend errors and stable error codes.

Use the codes `unknown_model`, `unsupported_mode`, `renderer_failed`, `tokenizer_unavailable`, and `registry_not_ready`. Single requests use appropriate HTTP status codes; batch results use typed unavailable objects without aborting other models.

- [x] Add `PromptRendererRegistry` with an identity Raw renderer and no universal Chat renderer.

The initial registry must make Chat/Tools unavailable until an explicit renderer is registered.

- [x] Return the authoritative `serializedText`, `mode`, IDs, count, and segments from both endpoints.

- [x] Update the TypeScript client to send a discriminated union rather than `(modelId, text)`.

```ts
type TokenizeInput =
  | { modelId: string; mode: "raw"; text: string }
  | { modelId: string; mode: "chat"; messages: ChatMessage[] }
  | { modelId: string; mode: "tools"; messages: ChatMessage[]; tools: ToolDefinition[] };
```

- [x] Run API and type checks.

Run:

```bash
backend/.venv/bin/python -m unittest backend.tests.test_structured_api -v
pnpm validate:backend-api
pnpm lint
```

Expected: Raw regression IDs remain unchanged; unsupported Chat/Tools return `unsupported_mode`.

Commit: `git commit -m "feat: add structured tokenization api"`

## Task 4: Add reviewed renderer implementations and golden fixtures

**Files:**

- Modify: `backend/app/prompt_renderer.py`
- Create: `backend/prompt_templates/`
- Create: `backend/fixtures/prompt-rendering.json`
- Create: `backend/tests/test_prompt_renderers.py`
- Modify: `backend/requirements.txt`
- Modify: `requirements.txt`
- Modify: `scripts/validate-model-evidence.mjs`

- [x] Add failing golden tests covering English, Chinese, emoji, combining characters, whitespace, special-token-looking text, and tool definitions.

Every fixture names `rendererKey`, mode, structured input, expected serialized text, and expected token IDs. Fixtures must originate from an official tokenizer/template at the pinned evidence revision.

- [x] Add sandboxed Jinja rendering for reviewed local templates.

Use `jinja2.sandbox.SandboxedEnvironment` with a small allowlist. Disable template loading outside `backend/prompt_templates`, block arbitrary attribute access/imports, and expose only reviewed helpers such as `raise_exception`. Never execute Hugging Face remote code.

- [x] Add dedicated reviewed encoders where the official format is code rather than Jinja.

Port only the minimal deterministic formatting logic when a custom-code Chat/Tools mode is advertised. DeepSeek V4 Flash 0731 and Kimi K3 remain unavailable for those modes in v0.2.0, so production does not execute or port their remote code.

- [x] Register only renderers with passing fixtures, then set corresponding model support flags.

Closed/API-only models without a reproducible official local formatter remain Raw-only even when their tokenizer is exact.

- [x] Make health report tokenizer and renderer readiness separately.

- [x] Run renderer, evidence, and API tests.

Run:

```bash
backend/.venv/bin/python -m unittest backend.tests.test_prompt_renderers -v
pnpm validate:evidence
pnpm validate:backend-api
```

Expected: all advertised Chat/Tools modes have a renderer and golden fixtures; unadvertised modes fail closed. Full evidence validation becomes green after Task 5 adds all 88 records.

Commit: `git commit -m "feat: render exact chat and tool prompts"`

## Task 5: Add the 17 v0.2.0 model entries and official assets

**Files:**

- Modify: `src/data/models.ts`
- Modify: `data/model-evidence.json`
- Modify: `scripts/tokenizer-assets.mjs`
- Modify: `backend/tokenizers/manifest.json`
- Add/modify: `backend/tokenizers/*`
- Modify: `backend/app/tokenizer_registry.py`
- Modify: `scripts/validate-model-catalog.mjs`
- Regenerate: `backend/catalog.json`

- [x] Add required-ID assertions for all 17 entries before editing the catalog.

Required additions:

```text
openai/gpt-5.6-sol
openai/gpt-5.6-terra
openai/gpt-5.6-luna
deepseek/deepseek-v4-flash-0731
z-ai/glm-5.2
moonshotai/kimi-k3
moonshotai/kimi-k2.7-code
minimax/minimax-m3
google/gemma-4-e2b-it
google/gemma-4-e4b-it
google/gemma-4-12b-it
google/gemma-4-26b-a4b-it
google/gemma-4-31b-it
meta/llama-4-scout-17b-16e-instruct
meta/llama-4-maverick-17b-128e-instruct
mistralai/mistral-small-4-119b-2603
mistralai/mistral-medium-3.5-128b
```

Run: `pnpm validate:models`

Expected: failure listing all missing additions and the 71-versus-88 count.

- [x] Pin official source commits and add evidence before downloading each asset.

Use canonical instruction/API-facing IDs only. Record official context sources. Do not substitute community mirrors for gated repositories without documenting the official-to-mirror byte identity.

- [x] Download tokenizer/config/template artifacts, verify hashes, then compress eligible `tokenizer.json` files.

Run: `pnpm download:tokenizers`

Expected: every new file matches its manifest hash before it enters the catalog.

- [x] Determine tokenizer reuse exclusively by SHA-256 and map shared assets to one `tokenizerKey`.

In particular, verify rather than assume reuse for GLM 5.2/5.1, Kimi K2.7/K2.x, the Gemma 4 sizes, Llama 4 variants, and the Mistral variants.

- [x] Extend the registry only for artifact formats not already handled by `tiktoken`, `tokenizer.json`, or local HF-tiktoken BPE.

Dedicated Kimi K3 or DeepSeek V4 logic must be local, deterministic, and fixture-covered.

- [x] Add the 17 models, classify superseded entries as preview/legacy, and change the default to a current active model.

Keep prior entries rather than rewriting history. Sort active models ahead of preview and legacy in exported selectors.

- [x] Regenerate the backend catalog and run model/tokenizer validations.

Run:

```bash
pnpm sync:backend-catalog
pnpm validate:models
pnpm validate:evidence
pnpm validate:tokenizer-reuse
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

Expected: exactly 88 models; all evidence, hashes, renderers, and raw tokenizer loads pass.

Commit: `git commit -m "feat: add v0.2 model snapshot"`

## Task 6: Make the UI mode-aware and backend-authoritative

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `src/lib/tokenizer.ts`
- Modify: `src/lib/tokenizer-api.ts`
- Modify: `scripts/validate-backend-architecture.mjs`
- Modify: `scripts/validate-exact-tokenizer-ui.mjs`
- Modify: `scripts/validate-initial-token-state-ui.mjs`
- Modify: `scripts/validate-all-models-ui.mjs`
- Create: `scripts/validate-mode-support-ui.mjs`
- Modify: `package.json`

- [x] Add failing source and Playwright checks proving the browser no longer serializes Chat/Tools.

Reject imports or calls to `renderChat` and `renderTools` from the page. Assert that the request body carries ordered messages/tools and that the displayed serialized prompt matches the backend response.

- [x] Delete the universal ChatML-like renderer from `src/lib/tokenizer.ts` after its callers are removed.

Keep only presentation helpers for backend-returned token segments.

- [x] Drive controls and badges from `model.support[activeMode]`.

Use `Exact` only for supported active modes and `Unavailable` otherwise. Unsupported controls remain visible but disabled with a short explanation.

- [x] Fix selection, lifecycle, and Compare behavior.

Replace stale `openai/gpt-5.5` defaults with existing active IDs. Compare sends only models supporting the active input mode, preserves unavailable results returned by the server, and never falls back to a different tokenizer or mode.

- [x] Preserve structured state across mode changes without stale results.

Changing model, mode, messages, or tools aborts the previous request, clears incompatible output, and renders only a response matching the latest request generation.

- [x] Add `validate:mode-ui` and run UI tests against local frontend/backend servers.

Run:

```bash
pnpm lint
pnpm validate:backend-architecture
pnpm validate:exact-ui http://localhost:3001
pnpm validate:initial-ui http://localhost:3001
pnpm validate:all-models-ui http://localhost:3001
pnpm validate:mode-ui http://localhost:3001
```

Expected: Raw, Chat, Tools, and Compare assertions pass with mode-specific support labels and no stale output.

Commit: `git commit -m "feat: expose mode-specific exact support"`

## Task 7: Update release metadata and operator documentation

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/backend-design.md`
- Create: `docs/releases/v0.2.0.md`

- [x] Bump the package version from `0.1.0` to `0.2.0` without unrelated dependency upgrades.

- [x] Update both READMEs with the 88-model, `2026-08-09` snapshot and precise Raw/Chat/Tools semantics.

Remove provider/model coverage claims that are not represented in the catalog. State clearly that unsupported modes cannot obtain local token IDs and that remote provider tokenization is intentionally out of scope.

- [x] Rewrite backend design sections for structured requests, renderer registry, evidence, SHA-256 identity, startup health, and deployment size considerations.

- [x] Add release notes listing additions, lifecycle changes, breaking API payload changes, migrations, deferred v0.2.1 candidates, and exclusions.

- [x] Run documentation consistency checks.

Run: `rg '0\.1\.0|2026-05-(10|11)|61 models|71 models|gpt-5\.5' README.md README.zh-CN.md docs package.json src backend scripts`

Expected: no stale release claims or invalid default IDs outside historical release context.

Commit: `git commit -m "docs: document tokenizer hub v0.2"`

## Task 8: Full verification and specification audit

**Files:**

- Modify only files required by failures discovered below.
- Update checkbox state in this plan as tasks complete.

- [x] Run the static and unit suite from a clean process environment.

```bash
pnpm lint
pnpm validate:context-format
pnpm validate:models
pnpm validate:evidence
pnpm validate:tokenizer-reuse
pnpm validate:backend-architecture
backend/.venv/bin/python -m unittest discover -s backend/tests -v
pnpm validate:segments
pnpm build
```

Expected: every command exits zero; build emits no missing-route or client/server-boundary errors.

- [x] Start the production-equivalent backend and verify health.

Run:

```bash
backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
curl -fsS http://127.0.0.1:8000/healthz
pnpm validate:backend-api http://127.0.0.1:8000
```

Expected: `ready`, tokenizer readiness, and renderer readiness are true with zero checksum errors.

- [x] Start the frontend and run the complete Playwright validation set.

Run:

```bash
pnpm dev -- --port 3001
pnpm validate:exact-ui http://localhost:3001
pnpm validate:initial-ui http://localhost:3001
pnpm validate:qwen-ui http://localhost:3001
pnpm validate:all-models-ui http://localhost:3001
pnpm validate:mode-ui http://localhost:3001
```

Expected: all scripts exit zero; browser console and network log contain no unhandled errors.

- [x] Audit every design-spec requirement against code, tests, evidence, or an explicit out-of-scope statement.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended v0.2 files are modified; the user's unrelated `HANDOFF.md` remains untouched and unstaged.

- [x] Commit only any verification fixes, then prepare the implementation summary with model count, mode coverage counts, asset size impact, and exact commands executed.

Commit, if needed: `git commit -m "test: verify tokenizer hub v0.2 release"`
