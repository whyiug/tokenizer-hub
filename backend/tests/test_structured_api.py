from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import main
from backend.app.tokenizer_registry import TokenizerRegistry


class StructuredApiTests(unittest.TestCase):
    def setUp(self) -> None:
        temp_dir = Path(tempfile.mkdtemp())
        catalog_path = temp_dir / "catalog.json"
        catalog_path.write_text(
            json.dumps(
                {
                    "tokenizers": {
                        "tiktoken:cl100k_base": {
                            "type": "tiktoken",
                            "encoding": "cl100k_base",
                            "label": "cl100k_base",
                        },
                    },
                    "models": [
                        {
                            "id": "openai/test",
                            "tokenizerKey": "tiktoken:cl100k_base",
                            "support": {"raw": True, "chat": False, "tools": False},
                            "rendererKey": None,
                        },
                    ],
                },
            ),
            encoding="utf-8",
        )
        self.original_registry = main.registry
        main.registry = TokenizerRegistry(catalog_path=catalog_path, tokenizer_root=temp_dir / "tokenizers")
        self.client_context = TestClient(main.app)
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)
        main.registry = self.original_registry

    def test_raw_request_returns_authoritative_serialized_text(self) -> None:
        response = self.client.post(
            "/v1/tokenize",
            json={"modelId": "openai/test", "mode": "raw", "text": "五道口纳什"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body.get("mode"), "raw")
        self.assertEqual(body.get("serializedText"), "五道口纳什")
        self.assertEqual(body["count"], 7)
        self.assertEqual(body["tokens"], [76208, 45893, 40526, 23043, 111, 6271, 222])

    def test_chat_and_tools_fail_with_unsupported_mode(self) -> None:
        for mode in ["chat", "tools"]:
            with self.subTest(mode=mode):
                response = self.client.post(
                    "/v1/tokenize",
                    json={
                        "modelId": "openai/test",
                        "mode": mode,
                        "messages": [{"role": "user", "content": "hello"}],
                        "tools": [] if mode == "tools" else None,
                    },
                )

                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json().get("detail"), {"code": "unsupported_mode", "message": "Mode chat is unavailable"} if mode == "chat" else {"code": "unsupported_mode", "message": "Mode tools is unavailable"})

    def test_unknown_model_has_stable_error_code(self) -> None:
        response = self.client.post(
            "/v1/tokenize",
            json={"modelId": "unknown/model", "mode": "raw", "text": "hello"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json().get("detail"), {"code": "unknown_model", "message": "Unknown modelId: unknown/model"})

    def test_raw_rejects_messages_instead_of_guessing(self) -> None:
        response = self.client.post(
            "/v1/tokenize",
            json={
                "modelId": "openai/test",
                "mode": "raw",
                "text": "hello",
                "messages": [{"role": "user", "content": "ignored"}],
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_batch_keeps_typed_unavailable_results(self) -> None:
        response = self.client.post(
            "/v1/tokenize/batch",
            json={
                "modelIds": ["openai/test", "unknown/model"],
                "mode": "raw",
                "text": "hello",
            },
        )

        self.assertEqual(response.status_code, 200)
        results = response.json()["results"]
        self.assertEqual(results[0].get("serializedText"), "hello")
        self.assertEqual(results[1].get("error"), {"code": "unknown_model", "message": "Unknown modelId: unknown/model"})
        self.assertTrue(results[1]["unavailable"])


if __name__ == "__main__":
    unittest.main()
