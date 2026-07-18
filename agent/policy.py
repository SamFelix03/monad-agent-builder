"""Policy engine — evaluates guardrails before tool execution."""
from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from registry_loader import get_tool_definitions, load_registry, resolve_tool_name

NATIVE_ALIASES = {"native", "mon", "0x0000000000000000000000000000000000000000"}


def merge_policies(agent_type: str, policies: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    reg = load_registry()
    defaults = reg.get("default_policies", {})
    merged: Dict[str, Any] = {}

    type_defaults = defaults.get(agent_type or "general", {})
    if isinstance(type_defaults, str):
        type_defaults = defaults.get(type_defaults, {})
    merged.update(type_defaults)

    if policies:
        merged.update(policies)
    return merged


def get_category_defaults_for_tool(tool_name: str) -> Dict[str, Any]:
    tool_name = resolve_tool_name(tool_name)
    reg_tools = {t["runtime_name"]: t for t in load_registry().get("tools", [])}
    tool_meta = reg_tools.get(tool_name, {})
    category = tool_meta.get("category", "")
    defaults = load_registry().get("default_policies", {})
    if category.startswith("trade") or tool_name in ("swap", "quote_swap", "get_portfolio", "get_trade_history"):
        td = defaults.get("trading", {})
        return dict(td) if isinstance(td, dict) else {}
    if category.startswith("commerce") or tool_name.startswith("product_") or tool_name in ("build_cart", "checkout_quote", "place_order"):
        td = defaults.get("shopping", {})
        return dict(td) if isinstance(td, dict) else {}
    return {}


def aggregate_policies_list(policies_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not policies_list:
        return {}
    result: Dict[str, Any] = {}
    numeric_mins = [
        "max_trade_notional_usd",
        "daily_spend_budget_usd",
        "approval_threshold_usd",
        "max_slippage_bps",
        "max_order_usd",
        "daily_shopping_budget_usd",
        "cooldown_seconds",
    ]
    for key in numeric_mins:
        values = [p[key] for p in policies_list if key in p and p[key] is not None]
        if values:
            result[key] = min(float(v) for v in values)
    if any(p.get("read_only") for p in policies_list):
        result["read_only"] = True
    if any(p.get("require_quote_before_swap") for p in policies_list):
        result["require_quote_before_swap"] = True
    if any(p.get("require_approval_for_checkout") for p in policies_list):
        result["require_approval_for_checkout"] = True
    allowlists = [p.get("merchant_allowlist") for p in policies_list if p.get("merchant_allowlist")]
    if allowlists:
        result["merchant_allowlist"] = list(
            set(allowlists[0]).intersection(*[set(a) for a in allowlists[1:]]) if len(allowlists) > 1 else allowlists[0]
        )
    token_lists = [p.get("allowed_tokens") for p in policies_list if p.get("allowed_tokens")]
    if token_lists:
        result["allowed_tokens"] = list(
            set(token_lists[0]).intersection(*[set(a) for a in token_lists[1:]]) if len(token_lists) > 1 else token_lists[0]
        )
    return result


def resolve_policies_for_tool(
    tool_name: str,
    tool_connections: List[Any],
    agent_policies: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Resolve per-node policies for a tool execution (strictest merge across matching nodes)."""
    tool_name = resolve_tool_name(tool_name)
    matching: List[Dict[str, Any]] = []
    for conn in tool_connections:
        conn_tool = resolve_tool_name(conn.tool if hasattr(conn, "tool") else conn.get("tool", ""))
        if conn_tool == tool_name:
            raw = conn.policies if hasattr(conn, "policies") else conn.get("policies", {})
            matching.append(raw or {})
    node_policies = aggregate_policies_list(matching) if matching else {}
    base = get_category_defaults_for_tool(tool_name)
    merged = {**base, **(agent_policies or {}), **node_policies}
    return merged


def resolve_config_for_tool(tool_name: str, tool_connections: List[Any]) -> Dict[str, Any]:
    tool_name = resolve_tool_name(tool_name)
    config: Dict[str, Any] = {}
    for conn in tool_connections:
        conn_tool = resolve_tool_name(conn.tool if hasattr(conn, "tool") else conn.get("tool", ""))
        if conn_tool == tool_name:
            raw = conn.config if hasattr(conn, "config") else conn.get("config", {})
            if raw:
                config.update(raw)
    return config


def _normalize_token(addr: str) -> str:
    if not addr:
        return "native"
    lower = addr.lower()
    if lower in NATIVE_ALIASES:
        return "native"
    return lower


def _token_allowed(token: str, allowlist: List[str]) -> bool:
    if not allowlist:
        return True
    normalized_allow = {_normalize_token(t) for t in allowlist}
    return _normalize_token(token) in normalized_allow


def _params_hash(tool: str, params: Dict[str, Any]) -> str:
    payload = json.dumps({"tool": tool, "params": params}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


class PolicyEngine:
    def __init__(
        self,
        agent_id: str,
        agent_type: str = "general",
        policies: Optional[Dict[str, Any]] = None,
        tool_configs: Optional[Dict[str, Any]] = None,
        spend_state: Optional[Dict[str, Any]] = None,
        raw_policies: bool = False,
    ):
        self.agent_id = agent_id
        self.agent_type = agent_type
        if raw_policies:
            self.policies = policies or {}
        else:
            self.policies = merge_policies(agent_type, policies)
        self.tool_configs = tool_configs or {}
        self.spend_state = spend_state or {
            "daily_spend_usd": 0.0,
            "daily_shopping_usd": 0.0,
            "last_swap_at": 0.0,
            "active_session": None,
        }

    def evaluate(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        quote_snapshot: Optional[Dict[str, Any]] = None,
        approved_action_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        tool_name = resolve_tool_name(tool_name)
        approved_action_ids = approved_action_ids or []

        if self.policies.get("read_only"):
            reg_tools = {t["runtime_name"]: t for t in load_registry().get("tools", [])}
            tool_meta = reg_tools.get(tool_name, {})
            if tool_meta.get("risk") in ("high", "medium") and tool_meta.get("requires_wallet"):
                return self._deny(tool_name, parameters, "Agent is read-only; write operations are disabled.")

        reg_tools = {t["runtime_name"]: t for t in load_registry().get("tools", [])}
        tool_meta = reg_tools.get(tool_name, {})
        category = tool_meta.get("category", "")

        if category == "trade_write" or tool_name == "swap":
            return self._evaluate_trade_write(tool_name, parameters, quote_snapshot, approved_action_ids)
        if (
            category.startswith("commerce")
            or tool_name in ("product_search", "product_details", "build_cart", "checkout_quote", "place_order")
        ):
            if tool_name == "place_order" or category == "commerce_write":
                return self._evaluate_commerce_write(tool_name, parameters, quote_snapshot, approved_action_ids)
            return self._evaluate_commerce_read(tool_name, parameters, quote_snapshot)

        return self._allow(tool_name, parameters, quote_snapshot)

    def _allow(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        quote_snapshot: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "decision": "allow",
            "tool": tool_name,
            "params_hash": _params_hash(tool_name, parameters),
            "quote_snapshot": quote_snapshot,
            "notional_usd": (quote_snapshot or {}).get("notional_usd"),
        }

    def _deny(self, tool_name: str, parameters: Dict[str, Any], reason: str) -> Dict[str, Any]:
        return {
            "decision": "deny",
            "tool": tool_name,
            "reason": reason,
            "params_hash": _params_hash(tool_name, parameters),
        }

    def _pending(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        summary: str,
        quote_snapshot: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "decision": "pending_approval",
            "tool": tool_name,
            "summary": summary,
            "params_hash": _params_hash(tool_name, parameters),
            "payload": parameters,
            "quote_snapshot": quote_snapshot,
            "notional_usd": (quote_snapshot or {}).get("notional_usd"),
        }

    def _evaluate_trade_write(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        quote_snapshot: Optional[Dict[str, Any]],
        approved_action_ids: List[str],
    ) -> Dict[str, Any]:
        policies = self.policies
        quote = quote_snapshot or {}

        if policies.get("require_quote_before_swap", True) and tool_name == "swap":
            quote_id = parameters.get("quoteId")
            if not quote_id:
                return self._deny(tool_name, parameters, "swap requires a quoteId from quote_swap first.")

        slippage = parameters.get("slippageTolerance")
        max_slippage_bps = policies.get("max_slippage_bps", 100)
        if slippage is not None and float(slippage) * 100 > max_slippage_bps:
            return self._deny(
                tool_name,
                parameters,
                f"Slippage {slippage}% exceeds max allowed {max_slippage_bps / 100}%.",
            )

        token_in = parameters.get("tokenIn") or quote.get("tokenIn")
        token_out = parameters.get("tokenOut") or quote.get("tokenOut")
        allowlist = policies.get("allowed_tokens", [])
        if allowlist:
            if token_in and not _token_allowed(str(token_in), allowlist):
                return self._deny(tool_name, parameters, f"Token in {token_in} is not on the allowlist.")
            if token_out and not _token_allowed(str(token_out), allowlist):
                return self._deny(tool_name, parameters, f"Token out {token_out} is not on the allowlist.")

        notional = quote.get("notional_usd")
        if notional is not None:
            max_trade = policies.get("max_trade_notional_usd")
            if max_trade is not None and float(notional) > float(max_trade):
                return self._deny(
                    tool_name,
                    parameters,
                    f"Trade notional ${notional:.2f} exceeds max ${max_trade:.2f} per trade.",
                )

            daily_budget = policies.get("daily_spend_budget_usd")
            daily_spent = float(self.spend_state.get("daily_spend_usd", 0))
            if daily_budget is not None and daily_spent + float(notional) > float(daily_budget):
                return self._deny(
                    tool_name,
                    parameters,
                    f"Daily spend budget exceeded (${daily_spent:.2f} + ${notional:.2f} > ${daily_budget:.2f}).",
                )

            approval_threshold = policies.get("approval_threshold_usd")
            if approval_threshold is not None and float(notional) > float(approval_threshold):
                approval_id = parameters.get("approvalId")
                if not approval_id or approval_id not in approved_action_ids:
                    return self._pending(
                        tool_name,
                        parameters,
                        f"Swap worth ~${float(notional):.2f} requires approval (threshold ${approval_threshold:.2f}).",
                        quote_snapshot,
                    )

        cooldown = policies.get("cooldown_seconds", 0)
        last_swap = float(self.spend_state.get("last_swap_at", 0))
        if cooldown and tool_name == "swap" and last_swap:
            elapsed = time.time() - last_swap
            if elapsed < cooldown:
                return self._deny(
                    tool_name,
                    parameters,
                    f"Cooldown active. Wait {int(cooldown - elapsed)}s before next swap.",
                )

        return self._allow(tool_name, parameters, quote_snapshot)

    def _effective_merchant_allowlist(self) -> List[str]:
        allowlist = list(self.policies.get("merchant_allowlist") or ["mock"])
        session = self.spend_state.get("active_session")
        if session and session.get("merchant_allowlist"):
            session_list = session["merchant_allowlist"]
            if isinstance(session_list, str):
                try:
                    session_list = json.loads(session_list)
                except json.JSONDecodeError:
                    session_list = [session_list]
            if session_list:
                allowlist = [p for p in allowlist if p in session_list] or list(session_list)
        return allowlist

    def _check_shopping_budget(self, tool_name: str, parameters: Dict[str, Any], total: float) -> Optional[Dict[str, Any]]:
        max_order = self.policies.get("max_order_usd")
        if max_order is not None and float(total) > float(max_order):
            return self._deny(tool_name, parameters, f"Order total ${total:.2f} exceeds max ${max_order:.2f}.")

        daily_budget = self.policies.get("daily_shopping_budget_usd")
        daily_spent = float(self.spend_state.get("daily_shopping_usd", 0))
        if daily_budget is not None and daily_spent + float(total) > float(daily_budget):
            return self._deny(
                tool_name,
                parameters,
                f"Daily shopping budget exceeded (${daily_spent:.2f} + ${total:.2f} > ${daily_budget:.2f}).",
            )

        session = self.spend_state.get("active_session")
        if session:
            remaining = float(session.get("budget_usd", 0)) - float(session.get("spent_usd", 0))
            if float(total) > remaining:
                return self._deny(
                    tool_name,
                    parameters,
                    f"Session budget remaining ${remaining:.2f} insufficient for ${total:.2f}.",
                )
        return None

    def _evaluate_commerce_read(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        quote_snapshot: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        provider = parameters.get("provider", "mock")
        allowlist = self._effective_merchant_allowlist()
        if allowlist and provider not in allowlist:
            return self._deny(tool_name, parameters, f"Provider '{provider}' is not on merchant allowlist.")

        total = (
            (quote_snapshot or {}).get("total_usd")
            or (quote_snapshot or {}).get("totalUsd")
            or (quote_snapshot or {}).get("subtotal_usd")
            or (quote_snapshot or {}).get("subtotalUsd")
            or (quote_snapshot or {}).get("notional_usd")
        )
        if total is not None:
            budget_deny = self._check_shopping_budget(tool_name, parameters, float(total))
            if budget_deny:
                return budget_deny

        return self._allow(tool_name, parameters, quote_snapshot)

    def _evaluate_commerce_write(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        quote_snapshot: Optional[Dict[str, Any]],
        approved_action_ids: List[str],
    ) -> Dict[str, Any]:
        read_result = self._evaluate_commerce_read(tool_name, parameters, quote_snapshot)
        if read_result["decision"] == "deny":
            return read_result

        if self.policies.get("require_approval_for_checkout", True) and tool_name == "place_order":
            approval_id = parameters.get("approvalId")
            if not approval_id or approval_id not in approved_action_ids:
                total = (
                    (quote_snapshot or {}).get("total_usd")
                    or (quote_snapshot or {}).get("totalUsd")
                    or "unknown"
                )
                return self._pending(
                    tool_name,
                    parameters,
                    f"Checkout (${total}) requires user approval before placing order.",
                    quote_snapshot,
                )

        return self._allow(tool_name, parameters, quote_snapshot)
