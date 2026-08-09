from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from tokenizers import Tokenizer, models

from backend.app import main
from backend.app.tokenizer_registry import TokenizerRegistry


class TokenizerManifestTests(unittest.TestCase):
    def _fixture(self, manifest_assets: dict[str, object]) -> tuple[TokenizerRegistry, Path]:
        temp_dir = Path(tempfile.mkdtemp())
        tokenizer_root = temp_dir / "tokenizers"
        asset_dir = tokenizer_root / "shared"
        asset_dir.mkdir(parents=True)

        tokenizer_path = asset_dir / "tokenizer.json"
        Tokenizer(models.WordLevel({"[UNK]": 0, "hello": 1}, unk_token="[UNK]")).save(str(tokenizer_path))
        (asset_dir / "tokenizer_config.json").write_text("{}\n", encoding="utf-8")

        catalog_path = temp_dir / "catalog.json"
        catalog_path.write_text(
            json.dumps(
                {
                    "tokenizers": {
                        "hf:shared": {
                            "type": "hf",
                            "asset": "shared",
                            "repo": "example/shared",
                            "label": "shared",
                        },
                    },
                    "models": [
                        {"id": "example/one", "tokenizerKey": "hf:shared"},
                        {"id": "example/two", "tokenizerKey": "hf:shared"},
                    ],
                },
            ),
            encoding="utf-8",
        )
        (tokenizer_root / "manifest.json").write_text(
            json.dumps({"version": 1, "assets": manifest_assets}),
            encoding="utf-8",
        )
        return TokenizerRegistry(catalog_path=catalog_path, tokenizer_root=tokenizer_root), tokenizer_path

    def test_preload_rejects_wrong_sha256(self) -> None:
        registry, _ = self._fixture(
            {
                "shared": {
                    "repo": "example/shared",
                    "revision": "a" * 40,
                    "files": [{"path": "shared/tokenizer.json", "size": 1, "sha256": "0" * 64}],
                },
            },
        )

        registry.preload()

        self.assertFalse(registry.ready)
        self.assertIn("shared/tokenizer.json", getattr(registry, "integrity_errors", {}))
        self.assertIn("SHA-256", getattr(registry, "integrity_errors", {}).get("shared/tokenizer.json", ""))

    def test_preload_rejects_missing_manifest_entry(self) -> None:
        registry, _ = self._fixture({})

        registry.preload()

        self.assertFalse(registry.ready)
        self.assertIn("shared", getattr(registry, "integrity_errors", {}))
        self.assertIn("manifest", getattr(registry, "integrity_errors", {}).get("shared", "").lower())

    def test_identical_sha256_allows_tokenizer_reuse(self) -> None:
        registry, tokenizer_path = self._fixture({})
        digest = hashlib.sha256(tokenizer_path.read_bytes()).hexdigest()
        manifest = {
            "version": 1,
            "assets": {
                "shared": {
                    "repo": "example/shared",
                    "revision": "a" * 40,
                    "files": [
                        {
                            "path": "shared/tokenizer.json",
                            "size": tokenizer_path.stat().st_size,
                            "sha256": digest,
                        },
                    ],
                },
            },
        }
        (registry.tokenizer_root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

        registry.preload()

        self.assertTrue(getattr(registry, "integrity_ready", False))
        self.assertTrue(registry.ready)
        self.assertEqual(registry.model_count, 2)
        self.assertEqual(registry.tokenizer_count, 1)

    def test_health_separates_integrity_and_tokenizer_errors(self) -> None:
        registry, _ = self._fixture(
            {
                "shared": {
                    "repo": "example/shared",
                    "revision": "a" * 40,
                    "files": [{"path": "shared/tokenizer.json", "size": 1, "sha256": "0" * 64}],
                },
            },
        )
        registry.preload()
        original_registry = main.registry
        main.registry = registry
        try:
            health = main.healthz()
        finally:
            main.registry = original_registry

        self.assertEqual(health.get("integrityReady"), False)
        self.assertIn("shared/tokenizer.json", health.get("checksumErrors", {}))
        self.assertEqual(health.get("tokenizerErrors"), {})


if __name__ == "__main__":
    unittest.main()
