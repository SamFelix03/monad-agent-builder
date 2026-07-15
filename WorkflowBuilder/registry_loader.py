"""Load unified tool registry (WorkflowBuilder)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List

_CACHE: Dict[str, Any] | None = None


def _path() -> Path:
    env = os.getenv("TOOL_REGISTRY_PATH")
    if env:
        return Path(env)
    return Path(__file__).resolve().parent.parent / "shared" / "tools" / "registry.json"


def load_registry() -> Dict[str, Any]:
    global _CACHE
    if _CACHE is None:
        with open(_path(), encoding="utf-8") as f:
            _CACHE = json.load(f)
    return _CACHE


def available_tools() -> List[str]:
    reg = load_registry()
    return [t["workflow_builder_name"] for t in reg.get("tools", [])]


def build_system_prompt_tools() -> str:
    lines = []
    for tool in load_registry().get("tools", []):
        lines.append(f"- {tool['workflow_builder_name']}: {tool['description']}")
    return "\n".join(lines)


def resolve_alias(name: str) -> str:
    aliases = load_registry().get("aliases", {})
    return aliases.get(name, name)
