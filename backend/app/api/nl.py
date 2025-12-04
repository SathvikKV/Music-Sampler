# app/api/nl.py
from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from app.services.llm import call_llm_json, LLMUnavailable

router = APIRouter()

@router.post("/nl/normalize")
async def normalize_query(payload: Dict[str, Any]):
    """
    Input: { "query": "gym pop running" }
    Output: {
      "original": "...",
      "normalized": "high energy pop for running 130-150 bpm",
      "tags": ["workout", "running", "pop", "high-energy"]
    }
    """
    q = payload.get("query")
    if not q:
        raise HTTPException(status_code=400, detail="query required")

    user_prompt = f"""
User query: {q}

Rewrite it as a music-intent query for Spotify-like search.

Return JSON:
{{
  "original": "...",
  "normalized": "...",
  "tags": ["...", "..."]
}}
"""
    try:
        data = await call_llm_json(
            "You clean up user music queries for a music discovery app.",
            user_prompt,
        )
    except LLMUnavailable:
        data = {
            "original": q,
            "normalized": q,
            "tags": [],
        }

    return data
