from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.app.prompt_renderer import (
    PromptRendererRegistry,
    RendererFailedError,
    UnsupportedModeError,
)

from backend.app.tokenizer_registry import (
    RegistryNotReadyError,
    TokenizerError,
    TokenizerRegistry,
    UnknownModelError,
)


registry = TokenizerRegistry()
renderers = PromptRendererRegistry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry.preload()
    yield


app = FastAPI(title="tokenizer_hub backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["system", "user", "assistant", "tool"]
    content: str


class StructuredContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["raw", "chat", "tools"]
    text: str | None = None
    messages: list[ChatMessage] | None = Field(default=None, min_length=1)
    tools: list[dict[str, Any]] | None = None

    @model_validator(mode="after")
    def validate_mode_content(self) -> "StructuredContent":
        if self.mode == "raw":
            if self.text is None or self.messages is not None or self.tools is not None:
                raise ValueError("Raw mode accepts text only")
            return self
        if self.text is not None or self.messages is None:
            raise ValueError(f"{self.mode.title()} mode accepts messages instead of text")
        if self.mode == "chat" and self.tools not in (None, []):
            raise ValueError("Chat mode does not accept tools")
        if self.mode == "tools" and self.tools is None:
            raise ValueError("Tools mode requires a tools array")
        return self


class TokenizeRequest(StructuredContent):
    modelId: str = Field(min_length=1)


class BatchTokenizeRequest(StructuredContent):
    modelIds: list[str] = Field(min_length=1)


def _error(code: str, message: str) -> dict[str, str]:
    return {"code": code, "message": message}


def _tokenize_structured(model_id: str, request: StructuredContent) -> dict[str, Any]:
    model = registry.get_model_spec(model_id)
    serialized_text = renderers.render(
        mode=request.mode,
        text=request.text,
        messages=[message.model_dump() for message in request.messages] if request.messages else None,
        tools=request.tools,
        support=model.support,
        renderer_key=model.renderer_key,
    )
    result = registry.tokenize(model_id, serialized_text)
    return {
        **result,
        "mode": request.mode,
        "serializedText": serialized_text,
    }


@app.get("/api/healthz")
@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ready": registry.ready,
        "integrityReady": registry.integrity_ready,
        "tokenizersLoaded": registry.tokenizer_count,
        "models": registry.model_count,
        "checksumErrors": registry.integrity_errors,
        "tokenizerErrors": registry.tokenizer_errors,
        "rendererReady": renderers.ready,
        "renderersLoaded": renderers.renderer_count,
        "rendererErrors": renderers.errors,
        "errors": registry.errors,
    }


@app.post("/api/v1/tokenize")
@app.post("/v1/tokenize")
def tokenize(request: TokenizeRequest) -> dict[str, Any]:
    try:
        return _tokenize_structured(request.modelId, request)
    except RegistryNotReadyError as exc:
        raise HTTPException(status_code=503, detail=_error("registry_not_ready", str(exc))) from exc
    except UnknownModelError as exc:
        raise HTTPException(status_code=404, detail=_error("unknown_model", str(exc))) from exc
    except UnsupportedModeError as exc:
        raise HTTPException(status_code=422, detail=_error("unsupported_mode", str(exc))) from exc
    except RendererFailedError as exc:
        raise HTTPException(status_code=500, detail=_error("renderer_failed", str(exc))) from exc
    except TokenizerError as exc:
        raise HTTPException(status_code=503, detail=_error("tokenizer_unavailable", str(exc))) from exc


@app.post("/api/v1/tokenize/batch")
@app.post("/v1/tokenize/batch")
def tokenize_batch(request: BatchTokenizeRequest) -> dict[str, Any]:
    if not registry.ready:
        raise HTTPException(status_code=503, detail="Tokenizer registry is not ready")

    results: list[dict[str, Any]] = []
    for model_id in request.modelIds:
        try:
            results.append(_tokenize_structured(model_id, request))
        except UnknownModelError as exc:
            results.append({"modelId": model_id, "error": _error("unknown_model", str(exc)), "unavailable": True})
        except UnsupportedModeError as exc:
            results.append({"modelId": model_id, "error": _error("unsupported_mode", str(exc)), "unavailable": True})
        except RendererFailedError as exc:
            results.append({"modelId": model_id, "error": _error("renderer_failed", str(exc)), "unavailable": True})
        except TokenizerError as exc:
            results.append({"modelId": model_id, "error": _error("tokenizer_unavailable", str(exc)), "unavailable": True})

    return {"results": results}
