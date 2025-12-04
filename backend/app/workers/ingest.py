# app/workers/ingest.py
import asyncio, json
from app.models.track import Track
from app.services.db import init_engine
import app.services.db as db  # <-- import the module, not SessionLocal

async def main():
    await init_engine()
    if db.SessionLocal is None:
        raise RuntimeError("DB not initialized; SessionLocal is None")

    async with db.SessionLocal() as session:  # type: ignore
        t = Track(
            provider="spotify",
            provider_track_id="spotify:track:3e9HZx...",
            title="Starboy",
            artist="The Weeknd",
            album="Starboy",
            duration_ms=230000,
            artwork_url="https://i.scdn.co/image/ab67616d0000b273...",
            features_json=json.dumps({
                "tempo":118, "energy":0.8, "valence":0.55,
                "danceability":0.78, "loudness":-6.1, "popularity":85
            }),
        )
        session.add(t)
        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
