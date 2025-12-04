# app/api/assistant.py
from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from app.services.llm import call_llm_json, LLMUnavailable

router = APIRouter()

@router.post("/assistant/plan")
async def assistant_plan(payload: Dict[str, Any]):
    """
    Input: { "message": "build me a 40 min late night synthwave set" }
    Output: {
      "normalized_query": "...",
      "duration_minutes": 40,
      "constraints": { ... },
      "slots": [
         {"mood": "high", "bpm_range": [120,130], "genres":["synthwave"]},
         ...
      ]
    }
    """
    message = payload.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="message required")

    user_prompt = f"""
User request:
{message}

You will produce a plan for a music discovery app.
Return JSON with:
- normalized_query: short cleaned version of the user's request
- duration_minutes: integer guess (default 30)
- constraints: {{"energy_curve": [...], "genres": [...], "moods": [...], "bpm_range": [low, high]}}
- slots: an array of 3-8 items, each item has {{ "label": str, "energy": 0..1, "valence": 0..1, "bpm_range": [low, high], "genres": [...] }}
"""
    try:
        plan = await call_llm_json(
            "You design playlists for a music sampler app. Always return JSON of the exact shape the user asked.",
            user_prompt,
        )
    except LLMUnavailable:
        plan = {
            "normalized_query": message,
            "duration_minutes": 30,
            "constraints": {"genres": [], "moods": [], "bpm_range": [0, 999]},
            "slots": [
                {"label": "general", "energy": 0.6, "valence": 0.5, "bpm_range": [100, 130], "genres": []}
            ],
        }

    return plan
