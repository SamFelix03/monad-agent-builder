"""Load unified tool registry from shared/tools/registry.json."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

_REGISTRY_CACHE: Optional[Dict[str, Any]] = None


def _registry_path() -> Path:
    env_path = os.getenv("TOOL_REGISTRY_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parent.parent / "shared" / "tools" / "registry.json"


def load_registry() -> Dict[str, Any]:
    global _REGISTRY_CACHE
    if _REGISTRY_CACHE is not None:
        return _REGISTRY_CACHE
    path = _registry_path()
    with open(path, encoding="utf-8") as f:
        _REGISTRY_CACHE = json.load(f)
    return _REGISTRY_CACHE


def resolve_tool_name(name: str) -> str:
    """Map legacy / alias names to canonical runtime names."""
    reg = load_registry()
    aliases = reg.get("aliases", {})
    return aliases.get(name, name)


def get_tool_definitions(backend_base_url: str) -> Dict[str, Dict[str, Any]]:
    """Build TOOL_DEFINITIONS dict keyed by runtime_name."""
    reg = load_registry()
    base = backend_base_url.rstrip("/")
    definitions: Dict[str, Dict[str, Any]] = {}

    for tool in reg.get("tools", []):
        runtime_name = tool["runtime_name"]
        definitions[runtime_name] = {
            "name": runtime_name,
            "description": tool["description"],
            "parameters": tool["llm_schema"],
            "endpoint": f"{base}{tool['endpoint']}",
            "method": tool["method"],
            "category": tool.get("category", "general"),
            "risk": tool.get("risk", "low"),
            "requires_wallet": tool.get("requires_wallet", False),
            "policy_hooks": tool.get("policy_hooks", []),
        }
    return definitions


def get_available_tool_names() -> List[str]:
    reg = load_registry()
    return [t["runtime_name"] for t in reg.get("tools", [])]


def get_default_policies(agent_type: str) -> Dict[str, Any]:
    reg = load_registry()
    defaults = reg.get("default_policies", {})
    policies = defaults.get(agent_type, {})
    if isinstance(policies, str):
        return dict(defaults.get(policies, {}))
    return dict(policies)


def get_template(name: str) -> Optional[Dict[str, Any]]:
    reg = load_registry()
    return reg.get("templates", {}).get(name)
