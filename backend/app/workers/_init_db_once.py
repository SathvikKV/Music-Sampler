# backend/app/workers/_init_db_once.py
import asyncio
from app.services.db import init_engine, Base
import app.models.user, app.models.oauth, app.models.track, app.models.session, app.models.events

async def main():
    await init_engine()
    from app.services.db import _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

asyncio.run(main())
