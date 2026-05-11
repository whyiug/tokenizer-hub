from __future__ import annotations

import json
import os
import gzip
import shutil
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
        segments = _segments_from_tiktoken_ids(text, ids, self._encoding)

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
        tokenizer_file = self._resolve_tokenizer_file(asset_dir, spec.asset)
        if not tokenizer_file.exists():
            raise TokenizerError(f"Missing tokenizer file for {spec.key}: {tokenizer_file}")

        from tokenizers import Tokenizer

        self.key = spec.key
        self.label = spec.label
        self._tokenizer = Tokenizer.from_file(str(tokenizer_file))

    def tokenize(self, text: str) -> dict[str, Any]:
        encoded = self._tokenizer.encode(text, add_special_tokens=False)
        ids = encoded.ids
        segments = self._segments_from_encoded(text, ids, encoded.tokens, encoded.offsets)

        return {
            "tokenizerKey": self.key,
            "label": self.label,
            "count": len(ids),
            "tokens": ids,
            "segments": segments,
        }

    def _segments_from_encoded(
        self,
        text: str,
        ids: list[int],
        pieces: list[str],
        offsets: list[tuple[int, int]],
    ) -> list[dict[str, Any]]:
        segments: list[dict[str, Any]] = []
        pending_ids: list[int] = []
        pending_pieces: list[str] = []
        pending_start = 0
        text_start: int | None = None
        text_end: int | None = None

        for token_index, token_id in enumerate(ids):
            if not pending_ids:
                pending_start = token_index
                text_start = None
                text_end = None

            pending_ids.append(token_id)
            if token_index < len(pieces):
                pending_pieces.append(pieces[token_index])

            if token_index < len(offsets):
                start, end = offsets[token_index]
                text_start = start if text_start is None else min(text_start, start)
                text_end = end if text_end is None else max(text_end, end)

            target_text = text[text_start:text_end] if text_start is not None and text_end is not None else ""
            decoded = self._decode_ids(pending_ids)
            if target_text and decoded == target_text:
                segments.append(
                    _make_segment(
                        len(segments),
                        pending_start,
                        pending_ids,
                        target_text,
                        text_start,
                        text_end,
                        pending_pieces,
                    ),
                )
                pending_ids = []
                pending_pieces = []

        if pending_ids:
            if text_start is not None and text_end is not None:
                token_text = text[text_start:text_end]
            else:
                token_text = self._decode_ids(pending_ids)
                text_start = 0
                text_end = len(token_text)
            segments.append(
                _make_segment(
                    len(segments),
                    pending_start,
                    pending_ids,
                    token_text,
                    text_start,
                    text_end,
                    pending_pieces,
                ),
            )

        return segments

    def _decode_ids(self, token_ids: list[int]) -> str:
        try:
            decoded = self._tokenizer.decode(
                token_ids,
                skip_special_tokens=False,
                clean_up_tokenization_spaces=False,
            )
            return decoded
        except TypeError:
            try:
                return self._tokenizer.decode(token_ids, skip_special_tokens=False)
            except Exception:
                pass
        except Exception:
            pass

        return ""

    def _resolve_tokenizer_file(self, asset_dir: Path, asset: str) -> Path:
        tokenizer_file = asset_dir / "tokenizer.json"
        if tokenizer_file.exists():
            return tokenizer_file

        compressed_file = asset_dir / "tokenizer.json.gz"
        if not compressed_file.exists():
            return tokenizer_file

        cache_dir = Path(os.environ.get("TOKENIZER_HUB_CACHE_DIR", "/tmp/tokenizer_hub_tokenizers")) / asset
        cache_file = cache_dir / "tokenizer.json"
        if cache_file.exists() and cache_file.stat().st_mtime >= compressed_file.stat().st_mtime:
            return cache_file

        cache_dir.mkdir(parents=True, exist_ok=True)
        temp_file = cache_file.with_suffix(".json.tmp")
        with gzip.open(compressed_file, "rb") as source, temp_file.open("wb") as target:
            shutil.copyfileobj(source, target)
        temp_file.replace(cache_file)
        return cache_file


class HfTiktokenBackendTokenizer:
    pat_str = "|".join(
        [
            r"""[\p{Han}]+""",
            r"""[^\r\n\p{L}\p{N}]?[\p{Lu}\p{Lt}\p{Lm}\p{Lo}\p{M}&&[^\p{Han}]]*[\p{Ll}\p{Lm}\p{Lo}\p{M}&&[^\p{Han}]]+(?i:'s|'t|'re|'ve|'m|'ll|'d)?""",
            r"""[^\r\n\p{L}\p{N}]?[\p{Lu}\p{Lt}\p{Lm}\p{Lo}\p{M}&&[^\p{Han}]]+[\p{Ll}\p{Lm}\p{Lo}\p{M}&&[^\p{Han}]]*(?i:'s|'t|'re|'ve|'m|'ll|'d)?""",
            r"""\p{N}{1,3}""",
            r""" ?[^\s\p{L}\p{N}]+[\r\n]*""",
            r"""\s*[\r\n]+""",
            r"""\s+(?!\S)""",
            r"""\s+""",
        ],
    )

    def __init__(self, spec: TokenizerSpec, tokenizer_root: Path) -> None:
        if not spec.asset:
            raise TokenizerError(f"Missing HF tiktoken asset for {spec.key}")

        asset_dir = tokenizer_root / spec.asset
        model_file = asset_dir / "tiktoken.model"
        config_file = asset_dir / "tokenizer_config.json"
        if not model_file.exists():
            raise TokenizerError(f"Missing tiktoken model for {spec.key}: {model_file}")
        if not config_file.exists():
            raise TokenizerError(f"Missing tokenizer config for {spec.key}: {config_file}")

        import tiktoken
        from tiktoken.load import load_tiktoken_bpe

        with config_file.open("r", encoding="utf-8") as file:
            config = json.load(file)

        mergeable_ranks = load_tiktoken_bpe(str(model_file))
        num_base_tokens = len(mergeable_ranks)
        added_tokens = {
            int(token_id): str(value["content"])
            for token_id, value in config.get("added_tokens_decoder", {}).items()
            if isinstance(value, dict) and "content" in value
        }
        special_tokens = {
            added_tokens.get(token_id, f"<|reserved_token_{token_id}|>"): token_id
            for token_id in range(num_base_tokens, num_base_tokens + 256)
        }

        self.key = spec.key
        self.label = spec.label
        self._special_tokens_by_id = {token_id: token for token, token_id in special_tokens.items()}
        self._encoding = tiktoken.Encoding(
            name=spec.asset,
            pat_str=self.pat_str,
            mergeable_ranks=mergeable_ranks,
            special_tokens=special_tokens,
        )

    def tokenize(self, text: str) -> dict[str, Any]:
        ids = self._encoding.encode(text, allowed_special="all", disallowed_special=())
        segments = _segments_from_tiktoken_ids(text, ids, self._encoding, self._special_tokens_by_id)

        return {
            "tokenizerKey": self.key,
            "label": self.label,
            "count": len(ids),
            "tokens": ids,
            "segments": segments,
        }


def _segments_from_tiktoken_ids(
    text: str,
    ids: list[int],
    encoding: Any,
    special_tokens_by_id: dict[int, str] | None = None,
) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    pending_bytes = bytearray()
    pending_ids: list[int] = []
    pending_start = 0
    cursor = 0

    for token_index, token_id in enumerate(ids):
        if not pending_ids:
            pending_start = token_index
        pending_ids.append(token_id)

        try:
            pending_bytes.extend(encoding.decode_single_token_bytes(token_id))
        except KeyError:
            token_text = (special_tokens_by_id or {}).get(token_id)
            if token_text is None:
                token_text = encoding.decode([token_id])
            pending_bytes.extend(token_text.encode("utf-8"))

        try:
            token_text = bytes(pending_bytes).decode("utf-8")
        except UnicodeDecodeError:
            continue

        if not text.startswith(token_text, cursor):
            continue

        text_start = cursor
        cursor += len(token_text)
        segments.append(_make_segment(len(segments), pending_start, pending_ids, token_text, text_start, cursor))
        pending_bytes.clear()
        pending_ids = []

    if pending_ids:
        try:
            token_text = bytes(pending_bytes).decode("utf-8")
        except UnicodeDecodeError:
            token_text = bytes(pending_bytes).decode("utf-8", errors="replace")
        segments.append(
            _make_segment(
                len(segments),
                pending_start,
                pending_ids,
                token_text,
                cursor,
                cursor + len(token_text),
            ),
        )

    return segments


def _make_segment(
    index: int,
    token_start: int,
    token_ids: list[int],
    text: str,
    text_start: int,
    text_end: int,
    pieces: list[str] | None = None,
) -> dict[str, Any]:
    segment: dict[str, Any] = {
        "index": index,
        "id": token_ids[0],
        "ids": list(token_ids),
        "text": text,
        "textStart": text_start,
        "textEnd": text_end,
        "tokenStart": token_start,
        "tokenEnd": token_start + len(token_ids),
    }
    if pieces:
        segment["piece"] = "".join(pieces)
        segment["pieces"] = list(pieces)
    return segment


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
            if not asset_dir.is_dir():
                continue
            if (asset_dir / "tokenizer.json").exists() or (asset_dir / "tokenizer.json.gz").exists():
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
            if (asset_dir / "tiktoken.model").exists():
                key = f"hf_tiktoken:{asset_dir.name}"
                self._specs.setdefault(
                    key,
                    TokenizerSpec(
                        key=key,
                        type="hf_tiktoken",
                        label=asset_dir.name,
                        asset=asset_dir.name,
                    ),
                )

    def _load_tokenizer(self, spec: TokenizerSpec) -> BackendTokenizer:
        if spec.type == "tiktoken":
            return TiktokenBackendTokenizer(spec)
        if spec.type == "hf":
            return HfBackendTokenizer(spec, self.tokenizer_root)
        if spec.type == "hf_tiktoken":
            return HfTiktokenBackendTokenizer(spec, self.tokenizer_root)
        raise TokenizerError(f"Unsupported tokenizer type for {spec.key}: {spec.type}")
