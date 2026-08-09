# Tokenizer Hub v0.2 Upgrade Design

**Status:** Approved direction, pending written-spec review

**Snapshot target:** 2026-08-09

**Release target:** v0.2.0

## Summary

Tokenizer Hub v0.2 will be a correctness-first catalog refresh. It will preserve the product's defining constraint—never present estimated tokenization as exact—while adding the most relevant model families released or missing from the catalog as of 2026-08-09.

The release will first distinguish exact raw-text tokenization from exact model-request serialization. It will then add a curated set of models whose tokenizer artifacts and request formats can be verified from official sources. Closed models that expose only counts, usage, or estimates will not be added. Remote tokenization APIs, including xAI's token-ID endpoint, are out of scope for v0.2 because they would send user prompts to a third party and introduce API-key, privacy, rate-limit, and abuse-control requirements.

## Current State

The repository is at package version `0.1.0`. The frontend snapshot is dated 2026-05-11 and contains 71 model entries across OpenAI, Qwen, DeepSeek, Moonshot AI, MiniMax, Xiaomi, Z.ai, and Meta. The catalog uses 22 shared Hugging Face tokenizer assets.

The current design has several strengths:

- Tokenizer artifacts are bundled locally and preloaded by the FastAPI backend.
- Model weights are never downloaded.
- Unsupported tokenizers fail closed instead of producing estimates.
- The frontend catalog is the source of truth and generates the backend catalog.
- Existing catalog, tokenizer-reuse, and backend-architecture validations pass.

The audit also found four correctness gaps that must be addressed before broadening coverage:

1. `renderChat` and `renderTools` serialize every model using the same ChatML-like markers. That serialization is not the official request format for every supported family.
2. The UI displays `Exact` without distinguishing exact raw BPE/SentencePiece tokenization from exact chat or tool-request serialization.
3. The default comparison list references `openai/gpt-5.5`, which is absent from the catalog.
4. The README claims provider coverage that is not present in the current model list.

## Product Principles

The following principles remain non-negotiable for v0.2:

1. **Correctness over breadth.** A popular model is not eligible merely because an approximate counter exists.
2. **Capability-specific claims.** Raw, Chat, and Tools support are evaluated independently.
3. **Official and reproducible sources.** Model IDs, context limits, tokenizer artifacts, and request templates must come from official provider repositories or documentation.
4. **Local-first tokenization.** User input stays within Tokenizer Hub's own frontend/backend boundary.
5. **No model weights.** Only tokenizer, template, encoder, and test-fixture assets may be stored.
6. **Curated snapshots.** Releases use manually reviewed snapshots rather than background synchronization.
7. **Fail closed.** If an exact path is unavailable or fails validation, the UI shows it as unavailable.
8. **Minimal product surface.** No export UI, catalog administration UI, remote-provider credentials, or speculative configuration will be added.

## Research Basis

The model priorities combine official release data with community adoption signals:

- Hugging Face's text-generation trending list on 2026-08-09 placed DeepSeek V4 Flash 0731 and GLM-5.2 at the top and also highlighted Laguna S 2.1.
- Official Hugging Face repositories expose tokenizer assets for DeepSeek V4 Flash 0731, GLM-5.2, Kimi K3, Kimi K2.7 Code, MiniMax M3, Gemma 4, Llama 4, and current Mistral models.
- The LocalLLaMA community discussion favored practically runnable model sizes, especially Gemma and Qwen, rather than treating every extremely large open-weight model as equally useful.
- Anthropic documents a tokenizer change beginning with Claude 4.7 and describes its token-count result as potentially differing slightly from actual message usage. Community reports reinforce that reusing an older or proxy tokenizer would be misleading.
- Gemini, Kimi's hosted count API, Qwen Cloud, Meta Model API, and OpenRouter publicly expose counts or usage but not the input token IDs and segments required by Tokenizer Hub. Kimi K3 is nevertheless eligible through its separate official open-weight repository, which includes local tokenizer and encoding assets.
- xAI exposes token IDs and token strings through its gRPC Tokenize API, but adopting it would require a new remote-processing product mode. That mode is deliberately excluded from this release.

Primary references:

- https://huggingface.co/models?inference_provider=all&pipeline_tag=text-generation&sort=trending
- https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731
- https://huggingface.co/zai-org/GLM-5.2
- https://huggingface.co/moonshotai/Kimi-K3
- https://huggingface.co/moonshotai/Kimi-K2.7-Code
- https://huggingface.co/MiniMaxAI/MiniMax-M3
- https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/
- https://ai.meta.com/blog/llama-4-multimodal-intelligence/
- https://huggingface.co/mistralai
- https://platform.claude.com/docs/en/build-with-claude/token-counting
- https://ai.google.dev/api/tokens
- https://platform.kimi.ai/docs/api/estimate
- https://docs.x.ai/developers/grpc-api-reference#tokenize
- https://www.reddit.com/r/LocalLLaMA/comments/1va73s6/the_openweights_carousel_never_stops/

## Support Semantics

Each model will declare support independently for three modes:

| Mode | Exact means | Eligibility requirement |
| --- | --- | --- |
| Raw | The submitted text is encoded by the model's verified tokenizer without inferred request framing. | Official tokenizer artifact or official local encoding library. |
| Chat | Structured messages are serialized using the model's verified official chat format and then encoded. | Raw support plus an official chat template/encoder and golden fixtures. |
| Tools | Structured messages and tool definitions are serialized using the model's verified official tool-call format and then encoded. | Chat support plus an official tool template/encoder and tool-call fixtures. |

The UI must not display a general `Exact` badge. It will display the support state for the active mode. A model may therefore be exact in Raw while unavailable in Chat or Tools.

Comparison mode compares the active serialized input only across models that support that mode. Unsupported rows remain visible with an explicit unavailable state rather than receiving an estimate.

## Architecture

### Catalog metadata

The frontend model entry will gain explicit lifecycle and capability metadata:

- `lifecycle`: `active`, `preview`, or `legacy`
- `support.raw`: exact local support
- `support.chat`: verified model-request support
- `support.tools`: verified tool-request support

Evidence that is operational rather than user-facing will live in a separate checked-in source manifest. For every active or preview model it will record:

- official model ID and provider
- official model/release URL
- context-window source URL
- tokenizer source repository and revision
- tokenizer artifact filenames and SHA-256 values
- template or encoder source and revision when applicable
- verification date

The existing compact `ModelEntry` remains the UI-facing snapshot. The evidence manifest prevents source and checksum details from bloating the client bundle.

### Tokenizer identity

Tokenizer reuse validation currently treats equal remote file size as sufficient. v0.2 will use SHA-256 identity as the reuse decision. File size remains a quick diagnostic only.

Every downloaded tokenizer artifact will be checked against the manifest before compression or catalog generation. A checksum mismatch will fail validation and prevent release.

### Structured request flow

Raw requests continue to send plain text.

Chat and Tools requests will send structured input to the backend:

- model ID
- active mode
- ordered messages with role and content
- tool definitions for Tools mode

The backend will resolve both a tokenizer and a prompt renderer from registries. The renderer produces the official serialized prompt, and the tokenizer returns IDs and segments for that serialized text. The response retains the serialized text so the current read-only prompt preview can display exactly what was counted.

Frontend-owned `renderChat` and `renderTools` will no longer determine counted text. Display-only formatting helpers may remain in the frontend, but the backend response is authoritative.

### Renderer strategy

Renderers are explicit and verified rather than inferred from provider names:

- Use checked-in official `chat_template.jinja` files where they can be rendered deterministically with a small, sandboxed Jinja environment.
- Use an official dedicated encoder when the provider does not publish a Jinja template. DeepSeek V4 Flash 0731 is the initial example: its official repository supplies `encoding_dsv4.py` and fixtures.
- Do not execute arbitrary remote code or enable Hugging Face `trust_remote_code` in production.
- If an official template depends on unsupported custom functions, mark the corresponding Chat or Tools capability unavailable until an explicit renderer is implemented and tested.

### Error handling

The backend will distinguish:

- unknown model
- unsupported mode
- renderer failure
- tokenizer unavailable
- artifact/checksum failure at startup

Unsupported modes return a typed unavailable result, not a generic server error. Startup health will report tokenizer and renderer readiness separately. The frontend will preserve the last valid result only for the exact same request key and will never fall back to an estimate.

## v0.2.0 Model Scope

The target catalog size is 88 models. Superseded preview entries remain searchable as legacy records rather than being removed.

### Add in v0.2.0

| Provider | Models | Rationale |
| --- | --- | --- |
| OpenAI | GPT-5.6 Sol, Terra, Luna | Current official family. Raw support uses the officially documented GPT-5.x tokenizer generation. Chat and Tools require separately verified request serialization. |
| DeepSeek | DeepSeek V4 Flash 0731 | Highest current adoption signal and a formal successor to the Flash preview. It has a distinct tokenizer and official message encoder fixtures. |
| Z.ai | GLM-5.2 | High adoption, 1M context, and raw-tokenizer reuse with the existing GLM-5 generation after SHA-256 verification. |
| Moonshot AI | `moonshotai/Kimi-K3` and `moonshotai/Kimi-K2.7-Code` | Kimi K3 is the current open-weight flagship with 1M context, more than 1.4M downloads, and official `tiktoken.model`, tokenizer configuration, and encoding code. K2.7 Code remains a high-signal coding release with its own published template. |
| MiniMax | MiniMax M3 | New 1M-context generation with a distinct official tokenizer and template. |
| Google | Gemma 4 E2B, E4B, 12B, 26B-A4B, 31B instruction models | Strong community demand across practical device sizes; one verified family tokenizer can cover representative sizes. |
| Meta | Llama 4 Scout and Maverick Instruct | Corrects the current gap between Llama 3.1 and the latest official open-weight Llama generation. |
| Mistral AI | `mistralai/Mistral-Small-4-119B-2603` and `mistralai/Mistral-Medium-3.5-128B` | Corrects the README/catalog mismatch and adds representative current global models without importing every variant. |

Where a family contains base, instruction, quantized, and provider-specific copies, only canonical instruction/API-facing entries are added. Quantization variants do not create separate catalog entries because they do not change tokenization.

### Lifecycle changes

- Make a current active model the default instead of GPT-3.5 Turbo.
- Mark historical GPT-3.5, GPT-4 snapshots, text-davinci, code-davinci, and Llama 2 entries as legacy while retaining their research value.
- Mark superseded DeepSeek V4 preview entries as preview/legacy and prioritize DeepSeek V4 Flash 0731 in ordering.
- Remove the stale `openai/gpt-5.5` default comparison reference and choose comparison defaults that exist and support the active mode.

### Defer to v0.2.1

- Poolside Laguna XS/S 2.1
- Tencent HY3
- Cohere Command A+ 05-2026 and North Mini Code
- Ministral 3 representative 3B, 8B, and 14B instruction models

These are valuable coverage additions but do not block the correctness foundation or the highest-signal model refresh.

### Explicitly out of scope

- Claude Fable, Mythos, and Opus families without a public local tokenizer
- Gemini API-only models
- Qwen API-only Max models without released tokenizer artifacts
- Meta Muse API-only models
- any future closed Kimi models without released local tokenizer assets
- Grok remote tokenization
- OpenRouter or provider usage-count integration
- multimodal image/audio/video token visualization
- remote API keys or bring-your-own-key UI
- automated model-catalog synchronization
- model benchmarks, pricing, quality rankings, or recommendations in the product UI

## Inclusion Gates

A model can enter the active catalog only when all applicable gates pass:

1. The model ID and release are confirmed by an official provider source.
2. The context limit is confirmed by an official source.
3. Raw tokenization is reproducible from official local artifacts.
4. Stored artifacts match recorded SHA-256 values.
5. Any claimed Chat or Tools mode matches an official template or encoder.
6. Golden fixtures cover English, Chinese, emoji, combining characters, whitespace, and special-token boundaries.
7. Family reuse is proven by checksum, not assumed from naming or architecture.
8. The compressed artifact and startup impact fit the existing Vercel deployment.
9. The model adds meaningful provider, tokenizer-family, lifecycle, or practical-size coverage rather than a cosmetic alias.

## Testing and Verification

### Unit and fixture tests

- Compare Raw output IDs against the official tokenizer for representative multilingual strings.
- Compare Chat serialized text and IDs against official template/encoder fixtures.
- Compare Tools serialized text and IDs against official tool-call fixtures when Tools is supported.
- Test unsupported-mode results separately from unknown-model and tokenizer-failure results.
- Test that special tokens are handled according to the official tokenizer configuration.
- Test SHA-256 manifest validation and failure messages.

### Catalog validation

- Ensure every active/preview model has complete evidence metadata.
- Ensure every declared support capability has a renderer/tokenizer implementation and fixtures.
- Ensure no remote-only model is marked locally exact.
- Ensure active default and comparison IDs exist.
- Ensure legacy entries remain searchable but sort after active entries.
- Keep the catalog below the existing 300-model ceiling.

### Integration and UI verification

- Verify Raw, Chat, Tools, and Compare across at least one model from every tokenizer family.
- Verify that switching models or modes cannot display a stale result.
- Verify that mode-specific exact/unavailable labels match backend capabilities.
- Verify all supported models through the batch endpoint.
- Run lint, production build, backend API, segment, catalog, reuse, architecture, and UI validation commands.
- Verify production health and key routes after deployment.

## Documentation

The release will update:

- package version from `0.1.0` to `0.2.0`
- English and Chinese README model coverage
- snapshot date and exact model count
- backend design notes for capability-specific exactness
- artifact identity rules from file-size equality to SHA-256
- local verification commands
- a short v0.2 release note listing added, legacy, and deferred families

The UI remains low-explanation. Detailed evidence and operational rules stay in repository documentation rather than new product panels.

## Delivery Sequence

1. **Catalog correctness:** add lifecycle/support metadata, source manifest, checksum validation, and fix stale defaults/documentation claims.
2. **Structured prompt architecture:** move authoritative Chat/Tools rendering to the backend and add typed unsupported-mode results.
3. **Renderer fixtures:** implement and verify official templates/encoders for existing families before declaring Chat/Tools exact.
4. **Model wave:** add v0.2.0 model artifacts and entries in small provider-based commits.
5. **Regression and deployment:** run full validation, measure bundle/startup impact, update documentation, deploy, and verify production.

Target dates from the 2026-08-09 planning snapshot:

- August 10–12: catalog/schema and evidence foundation
- August 13–17: structured request and renderer foundation
- August 18–22: tokenizer assets and model wave
- August 23–25: regression, documentation, and release candidate
- August 26: v0.2.0 production release
- Early September: evaluate v0.2.1 candidates from production and community feedback

## Success Criteria

v0.2.0 is complete when:

- No UI state claims `Exact` for a serialization path that lacks official verification.
- Raw, Chat, and Tools support are independently declared and enforced.
- The v0.2.0 model wave is present with official evidence and checksum-verified artifacts.
- Package metadata and release notes identify the release as v0.2.0.
- Closed/API-only models are not approximated or routed through third-party tokenization services.
- Default and comparison models are valid and active-mode compatible.
- README provider claims match the actual catalog.
- All required unit, fixture, backend, catalog, UI, lint, and production-build checks pass.
- Production health and the main application routes succeed after deployment.
