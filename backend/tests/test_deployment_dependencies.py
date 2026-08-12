from __future__ import annotations

import tomllib
import unittest
from pathlib import Path


class DeploymentDependencyTests(unittest.TestCase):
    def test_vercel_manifest_declares_prompt_renderer_dependency(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        project = tomllib.loads((repo_root / "pyproject.toml").read_text(encoding="utf-8"))
        dependencies = {
            dependency.split("[", 1)[0].split("=", 1)[0].strip().lower()
            for dependency in project["project"]["dependencies"]
        }

        self.assertIn("jinja2", dependencies)


if __name__ == "__main__":
    unittest.main()
