from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv
from groq import Groq
import json
import requests
import uvicorn

from registry_loader import (
    get_tool_definitions,
    get_available_tool_names,
    resolve_tool_name,
    get_default_policies,
)
from policy import PolicyEngine, resolve_policies_for_tool, resolve_config_for_tool, merge_policies
from db import fetch_spend_state, log_action, create_approval, get_approved_ids, is_configured

load_dotenv()

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:3001").rstrip("/")
SERVICE_SECRET = os.getenv("SERVICE_SECRET", "dev-service-secret-change-me")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
_groq_key = os.getenv("GROQ_API_KEY")
client: Optional[Groq] = Groq(api_key=_groq_key) if _groq_key else None

TOOL_DEFINITIONS = get_tool_definitions(BACKEND_BASE_URL)

app = FastAPI(title="Monad AI Agent Builder")


class ToolConnection(BaseModel):
    tool: str
    next_tool: Optional[str] = None
    next_node_id: Optional[str] = None
    node_id: Optional[str] = None
    policies: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)


class AgentPolicies(BaseModel):
    max_trade_notional_usd: Optional[float] = None
    daily_spend_budget_usd: Optional[float] = None
    approval_threshold_usd: Optional[float] = None
    max_slippage_bps: Optional[int] = None
    allowed_tokens: Optional[List[str]] = None
    require_quote_before_swap: Optional[bool] = None
    max_order_usd: Optional[float] = None
    daily_shopping_budget_usd: Optional[float] = None
    merchant_allowlist: Optional[List[str]] = None
    require_approval_for_checkout: Optional[bool] = None
    read_only: Optional[bool] = None
    cooldown_seconds: Optional[int] = None


class AgentRequest(BaseModel):
    tools: List[ToolConnection]
    user_message: str
    agent_id: Optional[str] = None
    user_id: Optional[str] = None
    wallet_address: Optional[str] = None
    agent_type: str = "general"
    policies: Dict[str, Any] = Field(default_factory=dict)
    tool_configs: Dict[str, Any] = Field(default_factory=dict)
    private_key: Optional[str] = None  # deprecated: use user_id + internal signing


class AgentResponse(BaseModel):
    agent_response: str
    tool_calls: List[Dict[str, Any]]
    results: List[Dict[str, Any]]
    pending_approvals: List[Dict[str, Any]] = Field(default_factory=list)


def build_system_prompt(tool_connections: List[ToolConnection], wallet_address: Optional[str] = None) -> str:
    unique_tools = set()
    tool_flow = {}

    for conn in tool_connections:
        name = resolve_tool_name(conn.tool)
        unique_tools.add(name)
        if conn.next_tool:
            next_name = resolve_tool_name(conn.next_tool)
            unique_tools.add(next_name)
            tool_flow[name] = next_name

    has_sequential = any(conn.next_tool for conn in tool_connections)

    system_prompt = """You are an AI agent for Monad (high-performance EVM L1). You help users with on-chain operations, trading, and shopping using only the tools available to you.

TRADING RULES:
- Always call quote_swap before swap and use the returned quoteId for swap.
- For shopping, use provider "mock" unless configured otherwise: search → build_cart → checkout_quote → ask user to confirm → place_order with approvalId and cartId.
- When placing an order, always include cartId and approvalId (after user approves).

AVAILABLE TOOLS:
"""

    for tool_name in unique_tools:
        if tool_name in TOOL_DEFINITIONS:
            tool_def = TOOL_DEFINITIONS[tool_name]
            system_prompt += f"\n- {tool_name}: {tool_def['description']}\n"

    if wallet_address:
        system_prompt += f"\nAgent wallet address: {wallet_address}\n"

    if has_sequential:
        system_prompt += "\n\nTOOL EXECUTION FLOW:\n"
        for tool, next_tool in tool_flow.items():
            system_prompt += f"- After {tool} completes, call {next_tool}\n"
        system_prompt += "\nExecute sequential tools in one turn without waiting for confirmation between steps.\n"
    else:
        system_prompt += "\nAsk for required parameters before tool calls. Explain results clearly.\n"

    system_prompt += """
IMPORTANT:
- Never ask for or mention private keys; signing is handled server-side.
- Respect policy denials and pending approvals; explain alternatives.
- Provide transaction hashes and explorer links when available.
"""
    return system_prompt


def _fetch_quote_snapshot(quote_id: str) -> Optional[Dict[str, Any]]:
    try:
        resp = requests.get(f"{BACKEND_BASE_URL}/quotes/{quote_id}", timeout=10)
        if resp.ok:
            return resp.json().get("quote")
    except requests.RequestException:
        pass
    return None


COMMERCE_TOOLS = frozenset({
    "product_search", "product_details", "build_cart", "checkout_quote", "place_order",
})


def _inject_commerce_defaults(
    tool_name: str,
    parameters: Dict[str, Any],
    effective_policies: Dict[str, Any],
    effective_config: Dict[str, Any],
) -> Dict[str, Any]:
    if tool_name not in COMMERCE_TOOLS:
        return parameters
    params = dict(parameters)
    if not params.get("provider"):
        params["provider"] = effective_config.get("provider")
    if not params.get("provider"):
        allowlist = effective_policies.get("merchant_allowlist") or ["mock"]
        params["provider"] = allowlist[0] if allowlist else "mock"
    return params


def _fetch_commerce_snapshot(tool_name: str, parameters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    provider = parameters.get("provider", "mock")
    cart_id = parameters.get("cartId")

    try:
        if tool_name in ("checkout_quote", "place_order") and cart_id:
            resp = requests.post(
                f"{BACKEND_BASE_URL}/commerce/checkout-quote",
                json={"cartId": cart_id, "provider": provider},
                timeout=10,
            )
            if resp.ok:
                data = resp.json()
                quote = data.get("quote") or data
                total = quote.get("totalUsd") or data.get("total_usd")
                return {**quote, "cartId": cart_id, "total_usd": total, "notional_usd": total}

        if tool_name == "build_cart" and parameters.get("items"):
            subtotal = 0.0
            for item in parameters.get("items", []):
                product_id = item.get("productId")
                if not product_id:
                    continue
                resp = requests.post(
                    f"{BACKEND_BASE_URL}/commerce/product",
                    json={"productId": product_id, "provider": provider},
                    timeout=10,
                )
                if resp.ok:
                    product = resp.json().get("product", {})
                    qty = float(item.get("quantity") or 1)
                    subtotal += float(product.get("priceUsd") or 0) * qty
            if subtotal > 0:
                return {"subtotal_usd": subtotal, "total_usd": subtotal, "notional_usd": subtotal}
    except requests.RequestException:
        pass
    return None


def _internal_headers() -> Dict[str, str]:
    return {"Content-Type": "application/json", "x-service-secret": SERVICE_SECRET}


def execute_tool_via_internal(
    user_id: str,
    agent_id: str,
    tool_name: str,
    parameters: Dict[str, Any],
    policy_context: Dict[str, Any],
) -> Dict[str, Any]:
    try:
        resp = requests.post(
            f"{BACKEND_BASE_URL}/internal/execute-tool",
            headers=_internal_headers(),
            json={
                "userId": user_id,
                "agentId": agent_id,
                "tool": tool_name,
                "parameters": parameters,
                "policyContext": policy_context,
            },
            timeout=120,
        )
        data = resp.json()
        if not resp.ok:
            return {"success": False, "tool": tool_name, "error": data.get("error", resp.text)}
        return {"success": True, "tool": tool_name, "result": data.get("result", data)}
    except requests.RequestException as e:
        return {"success": False, "tool": tool_name, "error": str(e)}


def execute_tool(
    tool_name: str,
    parameters: Dict[str, Any],
    *,
    agent_id: Optional[str] = None,
    user_id: Optional[str] = None,
    wallet_address: Optional[str] = None,
    agent_type: str = "general",
    policies: Optional[Dict[str, Any]] = None,
    tool_configs: Optional[Dict[str, Any]] = None,
    tool_connections: Optional[List[ToolConnection]] = None,
    private_key: Optional[str] = None,
) -> Dict[str, Any]:
    tool_name = resolve_tool_name(tool_name)

    if tool_name not in TOOL_DEFINITIONS:
        raise ValueError(f"Unknown tool: {tool_name}")

    parameters = dict(parameters)

    if tool_name == "deploy_erc20" and "totalSupply" in parameters and "initialSupply" not in parameters:
        parameters["initialSupply"] = parameters.pop("totalSupply")

    if tool_name in ("get_portfolio", "get_balance", "wallet_analytics") and "address" not in parameters and wallet_address:
        parameters["address"] = wallet_address

    if agent_id:
        parameters.setdefault("agentId", agent_id)

    tool_def = TOOL_DEFINITIONS[tool_name]
    connections = tool_connections or []
    if connections:
        effective_policies = resolve_policies_for_tool(tool_name, connections, policies)
        effective_config = {**(tool_configs or {}), **resolve_config_for_tool(tool_name, connections)}
        policy_raw = True
    else:
        effective_policies = merge_policies(agent_type, policies)
        effective_config = tool_configs or {}
        policy_raw = False

    parameters = _inject_commerce_defaults(tool_name, parameters, effective_policies, effective_config)

    quote_snapshot = None
    if tool_name == "swap" and parameters.get("quoteId"):
        quote_snapshot = _fetch_quote_snapshot(parameters["quoteId"])
    elif tool_name in COMMERCE_TOOLS:
        quote_snapshot = _fetch_commerce_snapshot(tool_name, parameters)

    spend_state = fetch_spend_state(agent_id) if agent_id else {}
    approved_ids = get_approved_ids(agent_id) if agent_id else []

    engine = PolicyEngine(
        agent_id=agent_id or "anonymous",
        agent_type=agent_type,
        policies=effective_policies,
        tool_configs=effective_config,
        spend_state=spend_state,
        raw_policies=policy_raw,
    )
    decision = engine.evaluate(tool_name, parameters, quote_snapshot, approved_ids)

    if decision["decision"] == "deny":
        if agent_id:
            log_action(
                agent_id, tool_name, "deny", decision.get("params_hash", ""),
                status="denied", error_message=decision.get("reason"),
            )
        return {
            "success": False,
            "tool": tool_name,
            "policy_decision": "deny",
            "error": decision.get("reason", "Policy denied"),
        }

    if decision["decision"] == "pending_approval":
        approval = None
        if agent_id and is_configured():
            approval = create_approval(
                agent_id,
                tool_name,
                decision.get("summary", "Approval required"),
                decision.get("payload", parameters),
                decision.get("quote_snapshot"),
            )
        if not approval and agent_id:
            try:
                resp = requests.post(
                    f"{BACKEND_BASE_URL}/internal/approvals",
                    headers=_internal_headers(),
                    json={
                        "agentId": agent_id,
                        "tool": tool_name,
                        "summary": decision.get("summary"),
                        "payload": decision.get("payload", parameters),
                        "quote_snapshot": decision.get("quote_snapshot"),
                    },
                    timeout=15,
                )
                if resp.ok:
                    approval = resp.json().get("approval")
            except requests.RequestException:
                pass

        return {
            "success": False,
            "tool": tool_name,
            "policy_decision": "pending_approval",
            "approval": approval,
            "summary": decision.get("summary"),
            "payload": decision.get("payload", parameters),
            "message": "This action requires your approval before it can proceed.",
        }

    policy_context = {
        "decision": "allow",
        "params_hash": decision.get("params_hash"),
        "quote_snapshot": decision.get("quote_snapshot") or quote_snapshot,
    }

    requires_wallet = tool_def.get("requires_wallet", False)

    # Server-side signing path (no private key in LLM)
    if requires_wallet and user_id and not private_key:
        return execute_tool_via_internal(user_id, agent_id or "", tool_name, parameters, policy_context)

    # Legacy / direct HTTP path
    if requires_wallet and user_id:
        try:
            resp = requests.post(
                f"{BACKEND_BASE_URL}/internal/execute-tool",
                headers=_internal_headers(),
                json={
                    "userId": user_id,
                    "agentId": agent_id,
                    "tool": tool_name,
                    "parameters": parameters,
                    "policyContext": policy_context,
                },
                timeout=120,
            )
            if resp.ok:
                data = resp.json()
                result = data.get("result", data)
                if agent_id:
                    log_action(
                        agent_id, tool_name, "allow", decision.get("params_hash", ""),
                        status="completed",
                        quote_snapshot=policy_context.get("quote_snapshot"),
                        notional_usd=result.get("notional_usd"),
                        tx_hash=result.get("swapTxHash"),
                    )
                return {"success": True, "tool": tool_name, "result": result}
        except requests.RequestException:
            pass

    if private_key and requires_wallet:
        parameters["privateKey"] = private_key

    endpoint = tool_def["endpoint"]
    method = tool_def["method"]

    if "{agentId}" in endpoint and agent_id:
        endpoint = endpoint.replace("{agentId}", agent_id)

    if method == "GET" and tool_name == "get_trade_history":
        limit = parameters.pop("limit", 10)
        endpoint = f"{endpoint}?limit={limit}"

    headers = {}
    try:
        if method == "POST":
            response = requests.post(endpoint, json=parameters, headers=headers, timeout=120)
        elif method == "GET":
            response = requests.get(endpoint, headers=headers, timeout=60)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()
        result = response.json()

        if agent_id:
            log_action(
                agent_id, tool_name, "allow", decision.get("params_hash", ""),
                status="completed",
                quote_snapshot=policy_context.get("quote_snapshot"),
                notional_usd=result.get("notional_usd") or result.get("total_usd"),
                tx_hash=result.get("swapTxHash") or result.get("transaction", {}).get("hash"),
            )

        return {"success": True, "tool": tool_name, "result": result}
    except requests.RequestException as e:
        if agent_id:
            log_action(
                agent_id, tool_name, "allow", decision.get("params_hash", ""),
                status="failed", error_message=str(e),
            )
        return {"success": False, "tool": tool_name, "error": str(e)}


def get_llm_tool_definitions(tool_names: List[str]) -> List[Dict[str, Any]]:
    tools = []
    for tool_name in tool_names:
        resolved = resolve_tool_name(tool_name)
        if resolved in TOOL_DEFINITIONS:
            tool_def = TOOL_DEFINITIONS[resolved]
            tools.append({
                "type": "function",
                "function": {
                    "name": resolved,
                    "description": tool_def["description"],
                    "parameters": tool_def["parameters"],
                },
            })
    return tools


def process_agent_conversation(
    system_prompt: str,
    user_message: str,
    available_tools: List[str],
    tool_flow: Dict[str, str],
    agent_id: Optional[str] = None,
    user_id: Optional[str] = None,
    wallet_address: Optional[str] = None,
    agent_type: str = "general",
    policies: Optional[Dict[str, Any]] = None,
    tool_configs: Optional[Dict[str, Any]] = None,
    tool_connections: Optional[List[ToolConnection]] = None,
    private_key: Optional[str] = None,
    max_iterations: int = 10,
) -> Dict[str, Any]:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    llm_tools = get_llm_tool_definitions(available_tools)
    all_tool_calls = []
    all_tool_results = []
    pending_approvals = []
    iteration = 0

    while iteration < max_iterations:
        iteration += 1

        if not client:
            return {
                "agent_response": "GROQ_API_KEY is not set. Add it to your .env file.",
                "tool_calls": all_tool_calls,
                "results": all_tool_results,
                "pending_approvals": pending_approvals,
                "conversation_history": messages,
            }

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            tools=llm_tools if llm_tools else None,
            tool_choice="auto" if llm_tools else None,
            temperature=0.7,
        )

        assistant_message = response.choices[0].message

        if not assistant_message.tool_calls:
            return {
                "agent_response": assistant_message.content,
                "tool_calls": all_tool_calls,
                "results": all_tool_results,
                "pending_approvals": pending_approvals,
                "conversation_history": messages,
            }

        messages.append({
            "role": "assistant",
            "content": assistant_message.content,
            "tool_calls": assistant_message.tool_calls,
        })

        for tool_call in assistant_message.tool_calls:
            function_name = resolve_tool_name(tool_call.function.name)
            function_args = json.loads(tool_call.function.arguments)

            all_tool_calls.append({"tool": function_name, "parameters": function_args})

            result = execute_tool(
                function_name,
                function_args,
                agent_id=agent_id,
                user_id=user_id,
                wallet_address=wallet_address,
                agent_type=agent_type,
                policies=policies,
                tool_configs=tool_configs,
                tool_connections=tool_connections,
                private_key=None,
            )
            all_tool_results.append(result)

            if result.get("policy_decision") == "pending_approval":
                pending_approvals.append(result)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result),
            })

        last_tool = all_tool_calls[-1]["tool"]
        if last_tool in tool_flow:
            next_tool = tool_flow[last_tool]
            messages.append({
                "role": "system",
                "content": f"Continue the sequence: call {next_tool} now.",
            })

    return {
        "agent_response": "Maximum iterations reached. Please try a simpler request.",
        "tool_calls": all_tool_calls,
        "results": all_tool_results,
        "pending_approvals": pending_approvals,
        "conversation_history": messages,
    }


@app.post("/agent/chat", response_model=AgentResponse)
async def chat_with_agent(request: AgentRequest):
    if not client:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured.")

    try:
        unique_tools = set()
        tool_flow = {}

        for conn in request.tools:
            name = resolve_tool_name(conn.tool)
            unique_tools.add(name)
            if conn.next_tool:
                next_name = resolve_tool_name(conn.next_tool)
                unique_tools.add(next_name)
                tool_flow[name] = next_name

        available_tools = list(unique_tools)

        for tool in available_tools:
            if tool not in TOOL_DEFINITIONS:
                raise HTTPException(status_code=400, detail=f"Unknown tool: {tool}")

        merged_policies = request.policies or {}

        system_prompt = build_system_prompt(request.tools, request.wallet_address)

        result = process_agent_conversation(
            system_prompt=system_prompt,
            user_message=request.user_message,
            available_tools=available_tools,
            tool_flow=tool_flow,
            agent_id=request.agent_id,
            user_id=request.user_id,
            wallet_address=request.wallet_address,
            agent_type=request.agent_type,
            policies=merged_policies,
            tool_configs=request.tool_configs,
            tool_connections=request.tools,
            private_key=None,
        )

        response_text = result["agent_response"] or ""
        if result.get("pending_approvals"):
            summaries = [p.get("summary", "Approval required") for p in result["pending_approvals"]]
            response_text += "\n\n⚠️ Approval required:\n" + "\n".join(f"- {s}" for s in summaries)

        return AgentResponse(
            agent_response=response_text,
            tool_calls=result["tool_calls"],
            results=result["results"],
            pending_approvals=result.get("pending_approvals", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Monad AI Agent Builder", "tools": len(TOOL_DEFINITIONS)}


@app.get("/tools")
async def list_tools():
    return {
        "tools": get_available_tool_names(),
        "details": {k: {"description": v["description"], "category": v.get("category")} for k, v in TOOL_DEFINITIONS.items()},
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
