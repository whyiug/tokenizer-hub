from __future__ import annotations

from typing import Any, Callable


class PromptRendererError(RuntimeError):
    pass


class UnsupportedModeError(PromptRendererError):
    pass


class RendererFailedError(PromptRendererError):
    pass


Renderer = Callable[[list[dict[str, str]], list[dict[str, Any]]], str]


class PromptRendererRegistry:
    def __init__(self) -> None:
        self._renderers: dict[str, Renderer] = {}

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
