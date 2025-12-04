# backend/app/models/base.py
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func, String


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """Project-wide declarative base."""
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

# Convenience: if you like, re-export metadata for Alembic
metadata = Base.metadata
