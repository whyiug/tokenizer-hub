from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import main
from backend.app.prompt_renderer import PromptRendererRegistry
from backend.app.tokenizer_registry import TokenizerRegistry


class PromptRendererTests(unittest.TestCase):
    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        temp_dir = Path(tempfile.mkdtemp())
        tokenizer_root = temp_dir / "tokenizers"
        shutil.copytree(repo_root / "backend" / "tokenizers" / "qwen3", tokenizer_root / "qwen3")
        source_manifest = json.loads((repo_root / "backend" / "tokenizers" / "manifest.json").read_text(encoding="utf-8"))
        (tokenizer_root / "manifest.json").write_text(
            json.dumps({"version": 1, "assets": {"qwen3": source_manifest["assets"]["qwen3"]}}),
            encoding="utf-8",
        )
        catalog_path = temp_dir / "catalog.json"
        catalog_path.write_text(
            json.dumps(
                {
                    "tokenizers": {
                        "hf:qwen3": {
                            "type": "hf",
                            "asset": "qwen3",
                            "repo": "Qwen/Qwen3-8B",
                            "label": "qwen3",
                        },
                    },
                    "models": [
                        {
                            "id": "qwen/qwen3-8b",
                            "tokenizerKey": "hf:qwen3",
                            "support": {"raw": True, "chat": True, "tools": True},
                            "rendererKey": "qwen3",
                        },
                    ],
                },
            ),
            encoding="utf-8",
        )
        self.fixtures = json.loads((repo_root / "backend" / "fixtures" / "prompt-rendering.json").read_text(encoding="utf-8"))
        self.original_registry = main.registry
        self.original_renderers = main.renderers
        main.registry = TokenizerRegistry(catalog_path=catalog_path, tokenizer_root=tokenizer_root)
        main.renderers = PromptRendererRegistry()
        self.client_context = TestClient(main.app)
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)
        main.registry = self.original_registry
        main.renderers = self.original_renderers

    def test_official_qwen3_chat_and_tools_fixtures(self) -> None:
        for fixture in self.fixtures:
            with self.subTest(fixture=fixture["name"]):
                request = {
                    "modelId": fixture["modelId"],
                    "mode": fixture["mode"],
                    "messages": fixture["messages"],
                }
                if fixture["mode"] == "tools":
                    request["tools"] = fixture["tools"]
                response = self.client.post("/v1/tokenize", json=request)

                self.assertEqual(response.status_code, 200, response.text)
                body = response.json()
                self.assertEqual(body["serializedText"], fixture["serializedText"])
                self.assertEqual(body["tokens"], fixture["tokens"])

    def test_health_reports_renderer_readiness_separately(self) -> None:
        health = main.healthz()

        self.assertEqual(health.get("rendererReady"), True)
        self.assertEqual(health.get("renderersLoaded"), 1)
        self.assertEqual(health.get("rendererErrors"), {})

    def test_catalog_advertises_only_fixture_backed_renderers(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        catalog = json.loads((repo_root / "backend" / "catalog.json").read_text(encoding="utf-8"))
        fixture_keys = {fixture["rendererKey"] for fixture in self.fixtures}
        qwen = next(model for model in catalog["models"] if model["id"] == "qwen/qwen3-8b")

        self.assertEqual(qwen["support"], {"raw": True, "chat": True, "tools": True})
        self.assertEqual(qwen["rendererKey"], "qwen3")
        for model in catalog["models"]:
            if model["support"]["chat"] or model["support"]["tools"]:
                self.assertIn(model["rendererKey"], fixture_keys)


if __name__ == "__main__":
    unittest.main()
