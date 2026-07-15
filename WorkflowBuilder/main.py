"""WorkflowBuilder — uses unified tool registry."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
import json
import os
import re
import logging
from dotenv import load_dotenv
from groq import Groq

from registry_loader import available_tools, build_system_prompt_tools, resolve_alias, load_registry

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Agent Workflow Builder API")
WORKFLOW_BUILDER_PORT = 8001

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
_groq_key = os.getenv("GROQ_API_KEY")
groq_client: Optional[Groq] = Groq(api_key=_groq_key) if _groq_key else None


class WorkflowRequest(BaseModel):
    user_query: str
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 2000


class ToolNode(BaseModel):
    id: str
    type: str
    name: str
    next_tools: List[str] = []


class WorkflowResponse(BaseModel):
    agent_id: str
    tools: List[ToolNode]
    has_sequential_execution: bool
    description: str
    raw_response: Optional[str] = None


def parse_llm_json_content(content: str) -> dict[str, Any]:
    text = (content or "").strip()
    if not text:
        raise ValueError("Empty model response")
    if "```" in text:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if m:
            text = m.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start : end + 1])


def _build_system_prompt() -> str:
    tools_block = build_system_prompt_tools()
    valid = ", ".join(available_tools())
    return f"""You are an AI that converts natural language descriptions of blockchain agent workflows into structured JSON.

Available tools (use exact type names):
{tools_block}

Valid tool type values: {valid}

Templates:
- Trading agent: get_portfolio, quote_swap, swap (sequential quote then swap)
- Shopping researcher: product_search, product_details
- Guarded shopper: product_search, build_cart, checkout_quote, place_order

Rules:
- Agent node id: "agent_1", type: "agent"
- Tool ids: "tool_1", "tool_2", ...
- Sequential: set next_tools; has_sequential_execution true if any next_tools non-empty
- Map user intent to canonical tool names only

Return ONLY valid JSON:
{{
  "agent_id": "agent_1",
  "tools": [{{"id": "tool_1", "type": "quote_swap", "name": "Quote Swap", "next_tools": ["tool_2"]}}],
  "has_sequential_execution": true,
  "description": "Brief description"
}}"""


@app.post("/create-workflow", response_model=WorkflowResponse)
async def create_workflow(request: WorkflowRequest):
    if not groq_client:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured.")

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _build_system_prompt()},
                {"role": "user", "content": request.user_query},
            ],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            response_format={"type": "json_object"},
        )

        raw_content = response.choices[0].message.content
        workflow_data = parse_llm_json_content(raw_content or "")

        # Normalize aliases in tool types
        for tool in workflow_data.get("tools", []):
            tool["type"] = resolve_alias(tool.get("type", ""))

        workflow_data["raw_response"] = raw_content
        return WorkflowResponse(**workflow_data)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Invalid JSON response: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Could not parse workflow JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/available-tools")
async def get_available_tools():
    reg = load_registry()
    return {
        "tools": available_tools(),
        "templates": list(reg.get("templates", {}).keys()),
        "default_policies": reg.get("default_policies", {}),
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=WORKFLOW_BUILDER_PORT, reload=True)
