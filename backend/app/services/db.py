# backend/app/services/db.py
from __future__ import annotations

from typing import Optional, AsyncIterator

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.pool import NullPool

from app.settings import settings
from app.models.base import Base  # main Base registry

_engine: Optional[AsyncEngine] = None
SessionLocal: Optional[async_sessionmaker[AsyncSession]] = None


def _build_async_url() -> str:
    """Build asyncpg DSN for SQLAlchemy."""
    return (
        f"postgresql+asyncpg://{settings.PG_USER}:{settings.PG_PASSWORD}"
        f"@{settings.PG_HOST}:{settings.PG_PORT}/{settings.PG_DB}"
    )


def _import_all_models() -> None:
    """
    Ensure all model classes are imported so that
    their tables register on Base.metadata.

    Without this, Alembic/SQLAlchemy may not see FK dependencies.
    """
    import app.models.user  # noqa: F401
    import app.models.oauth  # noqa: F401
    import app.models.track  # noqa: F401
    import app.models.session  # noqa: F401
    import app.models.events  # noqa: F401
    import app.models.playlist  # noqa: F401


async def init_engine() -> None:
    global _engine, SessionLocal
    if _engine is not None and SessionLocal is not None:
        return

    # import models before creating engine
    _import_all_models()

    _engine = create_async_engine(
        _build_async_url(),
        echo=False,
        poolclass=NullPool,  # good for containers
        future=True,
    )
    SessionLocal = async_sessionmaker(bind=_engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency for database sessions."""
    assert SessionLocal is not None, "Call init_engine() first"
    async with SessionLocal() as session:
        yield session
