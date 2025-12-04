# app/repositories/events.py
from __future__ import annotations
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.events import FeedEvent

async def record_event(
    db: AsyncSession,
    user_id: str,
    session_id: str,
    track_id: str,
    event_type: str,
    dwell_ms: int | None = None,
    position: int | None = None,
) -> FeedEvent:
    ev = FeedEvent(
        id=str(uuid4()),
        user_id=user_id,
        session_id=session_id,
        track_id=track_id,
        event_type=event_type,
        dwell_ms=dwell_ms,
        position=position,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev
