from __future__ import annotations

import unittest

from backend.app.tokenizer_registry import TokenizerRegistry


class V02TokenizerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry = TokenizerRegistry()
        cls.registry.preload()
        if not cls.registry.ready:
            raise AssertionError(cls.registry.errors)

    def test_new_family_raw_fixtures(self) -> None:
        text = "五道口纳什 🧪 e\u0301 <|open|>"
        fixtures = {
            "moonshotai/kimi-k3": [1742, 97168, 157562, 17137, 100, 103, 350, 37484, 220, 163587],
            "moonshotai/kimi-k2.7-code": [1742, 97168, 157562, 17137, 100, 103, 350, 37484, 22652, 4454, 91, 29],
            "deepseek/deepseek-v4-flash-0731": [2153, 896, 1573, 5107, 1556, 7351, 103, 106, 312, 17793, 818, 94, 9951, 94, 32],
            "google/gemma-4-e2b-it": [238367, 237497, 237768, 239741, 237970, 236743, 251646, 545, 238288, 655, 236909, 5265, 111038],
            "meta/llama-4-scout-17b-16e-instruct": [9809, 4709, 6314, 24182, 5828, 9522, 113, 116, 325, 7908, 440, 104, 4365, 159276],
            "mistralai/mistral-small-4-119b-2603": [17007, 4875, 19257, 66869, 10352, 119685, 1167, 1170, 1324, 1204, 1129, 1534, 1124, 7439, 1124, 1062],
        }

        for model_id, expected_ids in fixtures.items():
            with self.subTest(model_id=model_id):
                result = self.registry.tokenize(model_id, text)
                self.assertEqual(result["tokens"], expected_ids)
                self.assertEqual(result["count"], len(expected_ids))
                self.assertEqual("".join(segment["text"] for segment in result["segments"]), text)

    def test_kimi_k3_and_k27_keep_distinct_special_token_configs(self) -> None:
        self.assertEqual(self.registry.tokenize("moonshotai/kimi-k3", "<|open|>")["tokens"], [163587])
        self.assertNotEqual(
            self.registry.tokenize("moonshotai/kimi-k2.7-code", "<|open|>")["tokens"],
            [163587],
        )


if __name__ == "__main__":
    unittest.main()
