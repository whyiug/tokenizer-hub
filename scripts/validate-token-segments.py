from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.tokenizer_registry import TokenizerRegistry


SAMPLE = "你好，world! 这是 tokenizer_hub 的第一版测试。\n五道口纳什\nEmoji: 🧠🚀"


def main() -> None:
    registry = TokenizerRegistry()
    registry.preload()
    if not registry.ready:
        raise SystemExit(f"Tokenizer registry is not ready: {registry.errors}")

    failures: list[str] = []
    for model_id in sorted(registry._model_to_tokenizer):
        result = registry.tokenize(model_id, SAMPLE)
        tokens = result["tokens"]
        segments = result["segments"]
        segment_text = "".join(str(segment["text"]) for segment in segments)
        segment_ids = [token_id for segment in segments for token_id in segment.get("ids", [segment["id"]])]

        if segment_text != SAMPLE:
            failures.append(f"{model_id}: segment text did not reconstruct sample: {segment_text!r}")
        if segment_ids != tokens:
            failures.append(f"{model_id}: segment ids did not match tokens")
        if "\ufffd" in segment_text and "\ufffd" not in SAMPLE:
            failures.append(f"{model_id}: segment text contains replacement character: {segment_text!r}")

        for segment in segments:
            text_start = segment.get("textStart")
            text_end = segment.get("textEnd")
            token_start = segment.get("tokenStart")
            token_end = segment.get("tokenEnd")
            ids = segment.get("ids", [segment["id"]])

            if not isinstance(text_start, int) or not isinstance(text_end, int):
                failures.append(f"{model_id}: segment {segment['index']} is missing text span")
                continue
            if SAMPLE[text_start:text_end] != segment["text"]:
                failures.append(f"{model_id}: segment {segment['index']} text span did not match source text")

            if not isinstance(token_start, int) or not isinstance(token_end, int):
                failures.append(f"{model_id}: segment {segment['index']} is missing token span")
                continue
            if tokens[token_start:token_end] != ids:
                failures.append(f"{model_id}: segment {segment['index']} token span did not match token ids")

    if failures:
        raise SystemExit("\n".join(failures[:20]))

    print(f"Token segment integrity ok for {len(registry._model_to_tokenizer)} models.")


if __name__ == "__main__":
    main()
