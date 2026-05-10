from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.app.tokenizer_registry import (
    RegistryNotReadyError,
    TokenizerError,
    TokenizerRegistry,
    UnknownModelError,
)


registry = TokenizerRegistry()


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


class TokenizeRequest(BaseModel):
    modelId: str = Field(min_length=1)
    text: str


class BatchTokenizeRequest(BaseModel):
    modelIds: list[str] = Field(min_length=1)
    text: str


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ready": registry.ready,
        "tokenizersLoaded": registry.tokenizer_count,
        "models": registry.model_count,
        "errors": registry.errors,
    }


@app.post("/v1/tokenize")
def tokenize(request: TokenizeRequest) -> dict[str, Any]:
    try:
        return registry.tokenize(request.modelId, request.text)
    except RegistryNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except UnknownModelError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TokenizerError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/v1/tokenize/batch")
def tokenize_batch(request: BatchTokenizeRequest) -> dict[str, Any]:
    if not registry.ready:
        raise HTTPException(status_code=503, detail="Tokenizer registry is not ready")

    results: list[dict[str, Any]] = []
    for model_id in request.modelIds:
        try:
            results.append(registry.tokenize(model_id, request.text))
        except UnknownModelError as exc:
            results.append({"modelId": model_id, "error": str(exc), "unavailable": True})
        except TokenizerError as exc:
            results.append({"modelId": model_id, "error": str(exc), "unavailable": True})

    return {"results": results}
