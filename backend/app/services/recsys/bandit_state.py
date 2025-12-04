# app/services/recsys/bandit_state.py
from __future__ import annotations
import json
from typing import Literal
from app.services.cache import get_redis

EventType = Literal["like", "skip"]

def _k_user(user_id: str) -> str:
    return f"bandit:user:{user_id}:weights"

async def nudge(user_id: str, track_id: str, event: EventType) -> None:
    """
    Minimal nudge: like => +1, skip => -0.5 on per-track score (ephemeral).
    Your reranker can fetch this and add to score.
    """
    r = await get_redis()
    key = _k_user(user_id)
    delta = 1.0 if event == "like" else -0.5
    await r.zincrby(key, delta, track_id)
    # optional TTL to keep state fresh
    await r.expire(key, 60 * 60 * 24)  # 24h

async def get_scores(user_id: str) -> dict[str, float]:
    r = await get_redis()
    key = _k_user(user_id)
    pairs = await r.zrevrange(key, 0, -1, withscores=True)
    return {tid.decode() if isinstance(tid, bytes) else tid: float(s) for tid, s in pairs}
