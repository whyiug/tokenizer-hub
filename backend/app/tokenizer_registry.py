from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


class TokenizerError(RuntimeError):
    pass


class UnknownModelError(TokenizerError):
    pass


class RegistryNotReadyError(TokenizerError):
    pass


class BackendTokenizer(Protocol):
    key: str
    label: str

    def tokenize(self, text: str) -> dict[str, Any]:
        ...


@dataclass(frozen=True)
class TokenizerSpec:
    key: str
    type: str
    label: str
    encoding: str | None = None
    asset: str | None = None
    repo: str | None = None


class TiktokenBackendTokenizer:
    def __init__(self, spec: TokenizerSpec) -> None:
        if not spec.encoding:
            raise TokenizerError(f"Missing tiktoken encoding for {spec.key}")

        import tiktoken

        self.key = spec.key
        self.label = spec.label
        self._encoding = tiktoken.get_encoding(spec.encoding)

    def tokenize(self, text: str) -> dict[str, Any]:
        ids = self._encoding.encode(text, allowed_special="all", disallowed_special=())
        segments = []
        for index, token_id in enumerate(ids):
            piece = self._encoding.decode_single_token_bytes(token_id)
            token_text = piece.decode("utf-8", errors="replace")
            segments.append({"index": index, "id": token_id, "text": token_text})

        return {
            "tokenizerKey": self.key,
            "label": self.label,
            "count": len(ids),
            "tokens": ids,
            "segments": segments,
        }


class HfBackendTokenizer:
    def __init__(self, spec: TokenizerSpec, tokenizer_root: Path) -> None:
        if not spec.asset:
            raise TokenizerError(f"Missing HF tokenizer asset for {spec.key}")

        asset_dir = tokenizer_root / spec.asset
        tokenizer_file = asset_dir / "tokenizer.json"
        if not tokenizer_file.exists():
            raise TokenizerError(f"Missing tokenizer file for {spec.key}: {tokenizer_file}")

        from tokenizers import Tokenizer

        self.key = spec.key
        self.label = spec.label
        self._tokenizer = Tokenizer.from_file(str(tokenizer_file))

    def tokenize(self, text: str) -> dict[str, Any]:
        encoded = self._tokenizer.encode(text, add_special_tokens=False)
        ids = encoded.ids
        segments = self._segments_from_ids(ids, encoded.tokens)

        return {
            "tokenizerKey": self.key,
            "label": self.label,
            "count": len(ids),
            "tokens": ids,
            "segments": segments,
        }

    def _segments_from_ids(self, ids: list[int], pieces: list[str]) -> list[dict[str, Any]]:
        segments = []
        for index, token_id in enumerate(ids):
            piece = pieces[index] if index < len(pieces) else None
            token_text = self._decode_single(token_id, piece)
            segment = {"index": index, "id": token_id, "text": token_text}
            if piece is not None:
                segment["piece"] = piece
            segments.append(segment)
        return segments

    def _decode_single(self, token_id: int, piece: str | None) -> str:
        try:
            decoded = self._tokenizer.decode(
                [token_id],
                skip_special_tokens=False,
                clean_up_tokenization_spaces=False,
            )
            if decoded and "\ufffd" not in decoded:
                return decoded
        except TypeError:
            try:
                decoded = self._tokenizer.decode([token_id], skip_special_tokens=False)
                if decoded and "\ufffd" not in decoded:
                    return decoded
            except Exception:
                pass
        except Exception:
            pass

        return piece if piece is not None else str(token_id)


class TokenizerRegistry:
    def __init__(
        self,
        catalog_path: Path | None = None,
        tokenizer_root: Path | None = None,
    ) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        self.catalog_path = catalog_path or repo_root / "backend" / "catalog.json"
        self.tokenizer_root = tokenizer_root or repo_root / "backend" / "tokenizers"
        self.ready = False
        self.errors: dict[str, str] = {}
        self._specs: dict[str, TokenizerSpec] = {}
        self._model_to_tokenizer: dict[str, str] = {}
        self._tokenizers: dict[str, BackendTokenizer] = {}

    @property
    def tokenizer_count(self) -> int:
        return len(self._tokenizers)

    @property
    def model_count(self) -> int:
        return len(self._model_to_tokenizer)

    def preload(self) -> None:
        self.ready = False
        self.errors = {}
        self._specs, self._model_to_tokenizer = self._load_catalog()
        self._discover_local_hf_tokenizers()
        self._tokenizers = {}

        for key, spec in self._specs.items():
            try:
                self._tokenizers[key] = self._load_tokenizer(spec)
            except Exception as exc:
                self.errors[key] = str(exc)

        missing_model_keys = sorted(
            {
                tokenizer_key
                for tokenizer_key in self._model_to_tokenizer.values()
                if tokenizer_key not in self._tokenizers
            },
        )
        for tokenizer_key in missing_model_keys:
            self.errors.setdefault(tokenizer_key, "Tokenizer did not load")

        self.ready = not self.errors

    def tokenize(self, model_id: str, text: str) -> dict[str, Any]:
        if not self.ready:
            raise RegistryNotReadyError("Tokenizer registry is not ready")

        tokenizer_key = self._model_to_tokenizer.get(model_id)
        if tokenizer_key is None:
            raise UnknownModelError(f"Unknown modelId: {model_id}")

        tokenizer = self._tokenizers.get(tokenizer_key)
        if tokenizer is None:
            raise TokenizerError(f"Tokenizer unavailable for modelId: {model_id}")

        result = tokenizer.tokenize(text)
        return {"modelId": model_id, **result}

    def _load_catalog(self) -> tuple[dict[str, TokenizerSpec], dict[str, str]]:
        with self.catalog_path.open("r", encoding="utf-8") as file:
            catalog = json.load(file)

        specs = {
            key: TokenizerSpec(
                key=key,
                type=str(value["type"]),
                label=str(value.get("label") or value.get("encoding") or value.get("asset") or key),
                encoding=value.get("encoding"),
                asset=value.get("asset"),
                repo=value.get("repo"),
            )
            for key, value in catalog.get("tokenizers", {}).items()
        }
        model_to_tokenizer = {
            str(model["id"]): str(model["tokenizerKey"])
            for model in catalog.get("models", [])
        }

        unknown_tokenizers = sorted(
            tokenizer_key
            for tokenizer_key in model_to_tokenizer.values()
            if tokenizer_key not in specs
        )
        if unknown_tokenizers:
            raise TokenizerError(f"Catalog references unknown tokenizers: {unknown_tokenizers}")

        return specs, model_to_tokenizer

    def _discover_local_hf_tokenizers(self) -> None:
        if not self.tokenizer_root.exists():
            return

        for asset_dir in sorted(self.tokenizer_root.iterdir()):
            if not asset_dir.is_dir() or not (asset_dir / "tokenizer.json").exists():
                continue
            key = f"hf:{asset_dir.name}"
            self._specs.setdefault(
                key,
                TokenizerSpec(
                    key=key,
                    type="hf",
                    label=asset_dir.name,
                    asset=asset_dir.name,
                ),
            )

    def _load_tokenizer(self, spec: TokenizerSpec) -> BackendTokenizer:
        if spec.type == "tiktoken":
            return TiktokenBackendTokenizer(spec)
        if spec.type == "hf":
            return HfBackendTokenizer(spec, self.tokenizer_root)
        raise TokenizerError(f"Unsupported tokenizer type for {spec.key}: {spec.type}")
