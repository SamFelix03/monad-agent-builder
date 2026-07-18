"""Supabase client for agent service (audit log, spend state)."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def _supabase_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _backend_base_url() -> str:
    return os.getenv("BACKEND_BASE_URL", "http://localhost:3001").rstrip("/")


def _headers() -> Dict[str, str]:
    key = _supabase_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def is_configured() -> bool:
    return bool(_supabase_url() and _supabase_key())


def _utc_timestamp_z(value: Optional[datetime] = None) -> str:
    """PostgREST-safe UTC timestamp for URL filters (isoformat +00:00 breaks in query strings)."""
    dt = value or datetime.now(timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _require_configured() -> None:
    if not is_configured():
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")


def fetch_spend_state(agent_id: str) -> Dict[str, Any]:
    """Aggregate daily spend from agent_actions for policy checks."""
    default = {"daily_spend_usd": 0.0, "daily_shopping_usd": 0.0, "last_swap_at": 0.0, "active_session": None}

    if not is_configured():
        return default

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        url = (
            f"{_supabase_url()}/rest/v1/agent_actions"
            f"?agent_id=eq.{agent_id}"
            f"&status=eq.completed"
            f"&created_at=gte.{today}T00:00:00Z"
            f"&select=tool,notional_usd,created_at"
        )
        resp = requests.get(url, headers=_headers(), timeout=10)
        resp.raise_for_status()
        rows = resp.json()

        daily_spend = 0.0
        daily_shopping = 0.0
        last_swap_at = 0.0
        commerce_tools = {"place_order"}  # only completed purchases count toward daily budget

        for row in rows:
            n = float(row.get("notional_usd") or 0)
            tool = row.get("tool", "")
            if tool == "swap":
                daily_spend += n
                created = row.get("created_at", "")
                if created:
                    try:
                        ts = datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp()
                        last_swap_at = max(last_swap_at, ts)
                    except ValueError:
                        pass
            elif tool in commerce_tools:
                daily_shopping += n

        session_url = (
            f"{_supabase_url()}/rest/v1/agent_sessions"
            f"?agent_id=eq.{agent_id}"
            f"&status=eq.active"
            f"&expires_at=gt.{_utc_timestamp_z()}"
            f"&order=created_at.desc&limit=1"
        )
        session_resp = requests.get(session_url, headers=_headers(), timeout=10)
        session_resp.raise_for_status()
        sessions = session_resp.json()
        active_session = sessions[0] if sessions else None

        return {
            "daily_spend_usd": daily_spend,
            "daily_shopping_usd": daily_shopping,
            "last_swap_at": last_swap_at,
            "active_session": active_session,
        }
    except Exception as exc:
        logger.warning("fetch_spend_state failed for agent %s: %s", agent_id, exc)
        return default


def log_action(
    agent_id: str,
    tool: str,
    policy_decision: str,
    params_hash: str,
    status: str = "completed",
    quote_snapshot: Optional[Dict[str, Any]] = None,
    notional_usd: Optional[float] = None,
    tx_hash: Optional[str] = None,
    error_message: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not is_configured():
        return None
    payload = {
        "agent_id": agent_id,
        "tool": tool,
        "params_hash": params_hash,
        "policy_decision": policy_decision,
        "status": status,
        "quote_snapshot": quote_snapshot,
        "notional_usd": notional_usd,
        "tx_hash": tx_hash,
        "error_message": error_message,
    }
    try:
        resp = requests.post(
            f"{_supabase_url()}/rest/v1/agent_actions",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("log_action failed for agent %s tool %s: %s", agent_id, tool, exc)
        return None


def create_approval(
    agent_id: str,
    tool: str,
    summary: str,
    payload: Dict[str, Any],
    quote_snapshot: Optional[Dict[str, Any]] = None,
    ttl_minutes: int = 15,
) -> Optional[Dict[str, Any]]:
    _require_configured()

    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    approval_payload = dict(payload)
    if quote_snapshot:
        approval_payload["quote_snapshot"] = quote_snapshot

    body = {
        "agent_id": agent_id,
        "tool": tool,
        "summary": summary or "Approval required",
        "payload": approval_payload,
        "expires_at": _utc_timestamp_z(expires),
        "status": "pending",
    }
    try:
        resp = requests.post(
            f"{_supabase_url()}/rest/v1/agent_approvals",
            headers=_headers(),
            json=body,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except requests.HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        logger.error("create_approval failed for agent %s: %s", agent_id, detail)
        return None
    except Exception as exc:
        logger.error("create_approval failed for agent %s: %s", agent_id, exc)
        return None


def get_approved_ids(agent_id: str) -> List[str]:
    if not is_configured():
        return []
    try:
        now = _utc_timestamp_z()
        url = (
            f"{_supabase_url()}/rest/v1/agent_approvals"
            f"?agent_id=eq.{agent_id}"
            f"&status=eq.approved"
            f"&expires_at=gt.{now}"
            f"&select=id"
        )
        resp = requests.get(url, headers=_headers(), timeout=10)
        resp.raise_for_status()
        return [r["id"] for r in resp.json()]
    except Exception as exc:
        logger.warning("get_approved_ids failed for agent %s: %s", agent_id, exc)
        return []
