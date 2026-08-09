from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from jinja2 import FileSystemLoader, Undefined
from jinja2.sandbox import SandboxedEnvironment
from jinja2.utils import Namespace


class PromptRendererError(RuntimeError):
    pass


class UnsupportedModeError(PromptRendererError):
    pass


class RendererFailedError(PromptRendererError):
    pass


Renderer = Callable[[list[dict[str, str]], list[dict[str, Any]]], str]


class PromptRendererRegistry:
    TEMPLATE_FILES = {"qwen3": "qwen3.jinja"}

    def __init__(self, template_root: Path | None = None) -> None:
        self._renderers: dict[str, Renderer] = {}
        self.errors: dict[str, str] = {}
        root = template_root or Path(__file__).resolve().parents[1] / "prompt_templates"
        environment = SandboxedEnvironment(
            loader=FileSystemLoader(root),
            autoescape=False,
            undefined=Undefined,
        )
        environment.globals = {"namespace": Namespace}
        environment.filters = {
            name: environment.filters[name]
            for name in ["length", "string", "tojson", "trim"]
        }
        environment.tests = {
            name: environment.tests[name]
            for name in ["defined", "string"]
        }

        for key, filename in self.TEMPLATE_FILES.items():
            try:
                template = environment.get_template(filename)
                self._renderers[key] = lambda messages, tools, template=template: template.render(
                    messages=messages,
                    tools=tools,
                    add_generation_prompt=True,
                )
            except Exception as exc:
                self.errors[key] = str(exc)

    @property
    def ready(self) -> bool:
        return not self.errors

    @property
    def renderer_count(self) -> int:
        return len(self._renderers)

    def render(
        self,
        *,
        mode: str,
        text: str | None,
        messages: list[dict[str, str]] | None,
        tools: list[dict[str, Any]] | None,
        support: dict[str, bool],
        renderer_key: str | None,
    ) -> str:
        if not support.get(mode, False):
            raise UnsupportedModeError(f"Mode {mode} is unavailable")
        if mode == "raw":
            if text is None:
                raise RendererFailedError("Raw mode requires text")
            return text

        if not renderer_key or renderer_key not in self._renderers:
            raise RendererFailedError(f"Renderer unavailable for exact {mode} mode")

        try:
            return self._renderers[renderer_key](messages or [], tools or [])
        except PromptRendererError:
            raise
        except Exception as exc:
            raise RendererFailedError(str(exc)) from exc
