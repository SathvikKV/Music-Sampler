# app/api/feedback.py
from __future__ import annotations
from typing import Literal, Optional
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.db import get_db

# record_event may enforce enums/constraints in your DB; keep calls guarded
try:
    from app.repositories.events import record_event
    have_events_repo = True
except Exception:
    have_events_repo = False

# bandit is optional during bring-up
try:
    from app.services.recsys.bandit_state import nudge
    have_bandit = True
except Exception:
    have_bandit = False

log = logging.getLogger(__name__)
router = APIRouter()

FeedbackEvent = Literal["start", "complete", "like", "dislike", "skip", "save"]

class FeedbackIn(BaseModel):
    user_id: str
    session_id: str
    track_id: str
    event: FeedbackEvent
    dwell_ms: Optional[int] = None
    position: Optional[int] = None

class FeedbackOut(BaseModel):
    ok: bool

@router.post("/feedback", response_model=FeedbackOut)
async def post_feedback(payload: FeedbackIn, db: AsyncSession = Depends(get_db)):
    # Try to write to events table; never fail the request
    if have_events_repo:
        try:
            # If your DB has a strict enum for event_type (e.g. only like/skip),
            # map non-core events to a safe label to avoid integrity errors.
            db_event = payload.event
            safe_event = db_event if db_event in ("like", "skip") else "view"
            await record_event(
                db,
                user_id=payload.user_id,
                session_id=payload.session_id,
                track_id=payload.track_id,
                event_type=safe_event,
                dwell_ms=payload.dwell_ms,
                position=payload.position,
            )
        except Exception as e:
            log.exception("record_event failed: %s", e)

    # Optional: nudge bandit only for signals it understands
    if have_bandit:
        try:
            if payload.event == "like":
                await nudge(payload.user_id, payload.track_id, "like")
            elif payload.event in ("skip", "dislike"):
                await nudge(payload.user_id, payload.track_id, "skip")
        except Exception as e:
            log.exception("bandit nudge failed: %s", e)

    return FeedbackOut(ok=True)
