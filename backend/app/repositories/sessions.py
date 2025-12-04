# app/repositories/sessions.py
from __future__ import annotations
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.session import Session
import json

async def create_session(db: AsyncSession, user_id: str, seed_json: dict | None = None) -> Session:
    json_text = json.dumps(seed_json or {})  # << serialize dict to text
    s = Session(id=str(uuid4()), user_id=user_id, seed_json=json_text)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s

async def get_session(db: AsyncSession, session_id: str) -> Session | None:
    res = await db.execute(select(Session).where(Session.id == session_id))
    return res.scalar_one_or_none()
