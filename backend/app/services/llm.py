# app/services/llm.py
from __future__ import annotations
import os
from typing import Any, Dict, Optional

import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# You can change this to gpt-4o, gpt-4.1, etc.
DEFAULT_MODEL = "gpt-4o-mini"

class LLMUnavailable(Exception):
    pass

async def call_llm_json(system_prompt: str, user_prompt: str, model: str = DEFAULT_MODEL) -> Dict[str, Any]:
    """
    Call OpenAI and ask for JSON. If no key is set, raise LLMUnavailable so
    the API handler can return a friendly error.
    """
    if not OPENAI_API_KEY:
        raise LLMUnavailable("OPENAI_API_KEY not set")

    payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    # content is JSON string because we asked for json_object
    import json
    return json.loads(content)
