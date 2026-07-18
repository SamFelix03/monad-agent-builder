"""Supabase client for agent service (audit log, spend state)."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:3001").rstrip("/")


def _headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def is_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


def fetch_spend_state(agent_id: str) -> Dict[str, Any]:
    """Aggregate daily spend from agent_actions for policy checks."""
    default = {"daily_spend_usd": 0.0, "daily_shopping_usd": 0.0, "last_swap_at": 0.0, "active_session": None}

    if not is_configured():
        try:
            resp = requests.get(
                f"{BACKEND_BASE_URL}/agents/{agent_id}/sessions/active",
                timeout=10,
            )
            if resp.ok:
                session = resp.json().get("session")
                return {**default, "active_session": session}
        except Exception:
            pass
        return default

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        # Trades today
        url = (
            f"{SUPABASE_URL}/rest/v1/agent_actions"
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
        commerce_tools = {"place_order", "checkout_quote", "build_cart"}

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

        # Active session
        session_url = (
            f"{SUPABASE_URL}/rest/v1/agent_sessions"
            f"?agent_id=eq.{agent_id}"
            f"&status=eq.active"
            f"&expires_at=gt.{datetime.now(timezone.utc).isoformat()}"
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
    except Exception:
        return {"daily_spend_usd": 0.0, "daily_shopping_usd": 0.0, "last_swap_at": 0.0, "active_session": None}


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
            f"{SUPABASE_URL}/rest/v1/agent_actions",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception:
        return None


def create_approval(
    agent_id: str,
    tool: str,
    summary: str,
    payload: Dict[str, Any],
    quote_snapshot: Optional[Dict[str, Any]] = None,
    ttl_minutes: int = 15,
) -> Optional[Dict[str, Any]]:
    if not is_configured():
        return None
    from datetime import timedelta

    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    body = {
        "agent_id": agent_id,
        "tool": tool,
        "summary": summary,
        "payload": {**payload, "quote_snapshot": quote_snapshot},
        "expires_at": expires.isoformat(),
        "status": "pending",
    }
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/agent_approvals",
            headers=_headers(),
            json=body,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception:
        return None


def get_approved_ids(agent_id: str) -> List[str]:
    if not is_configured():
        try:
            resp = requests.get(
                f"{BACKEND_BASE_URL}/agents/{agent_id}/approvals/approved",
                timeout=10,
            )
            if resp.ok:
                return resp.json().get("ids", [])
        except Exception:
            pass
        return []
    try:
        now = datetime.now(timezone.utc).isoformat()
        url = (
            f"{SUPABASE_URL}/rest/v1/agent_approvals"
            f"?agent_id=eq.{agent_id}"
            f"&status=eq.approved"
            f"&expires_at=gt.{now}"
            f"&select=id"
        )
        resp = requests.get(url, headers=_headers(), timeout=10)
        resp.raise_for_status()
        return [r["id"] for r in resp.json()]
    except Exception:
        try:
            resp = requests.get(
                f"{BACKEND_BASE_URL}/agents/{agent_id}/approvals/approved",
                timeout=10,
            )
            if resp.ok:
                return resp.json().get("ids", [])
        except Exception:
            pass
        return []
