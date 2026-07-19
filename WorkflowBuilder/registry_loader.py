"""Load unified tool registry (WorkflowBuilder)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List

_CACHE: Dict[str, Any] | None = None


def _registry_path() -> Path:
    env_path = os.getenv("TOOL_REGISTRY_PATH")
    if env_path:
        path = Path(env_path)
        if not path.is_file():
            raise FileNotFoundError(f"TOOL_REGISTRY_PATH does not exist: {path}")
        return path

    here = Path(__file__).resolve().parent
    candidates: List[Path] = [
        here / "shared" / "tools" / "registry.json",
        here.parent / "shared" / "tools" / "registry.json",
    ]
    for parent in here.parents:
        candidates.append(parent / "shared" / "tools" / "registry.json")

    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if candidate.is_file():
            return candidate

    raise FileNotFoundError(
        "Could not find shared/tools/registry.json. "
        "Set TOOL_REGISTRY_PATH or include WorkflowBuilder/shared/tools/registry.json in the deploy."
    )


def load_registry() -> Dict[str, Any]:
    global _CACHE
    if _CACHE is None:
        with open(_registry_path(), encoding="utf-8") as f:
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
