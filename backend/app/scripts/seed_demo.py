# backend/app/scripts/seed_demo.py
import asyncio, json
from app.services.db import init_engine
import app.services.db as db
from app.models.track import Track

async def main():
    await init_engine()
    async with db.SessionLocal() as s:
        demo = [
            ("spotify", "spotify:track:3e9HZx...", "Starboy", "The Weeknd", "Starboy", 230000, 118, 0.8, 0.55, 0.78, -6.1, 85),
            ("spotify", "spotify:track:0VjIjW4GlUZAMYd2vXMi3b", "Blinding Lights", "The Weeknd", "After Hours", 200000, 171, 0.73, 0.33, 0.80, -5.0, 90),
        ]
        for prov, pid, title, artist, album, dur, tempo, energy, valence, dance, loud, pop in demo:
            s.add(Track(
                provider=prov, provider_track_id=pid, title=title, artist=artist, album=album,
                duration_ms=dur, artwork_url="https://i.scdn.co/image/ab67616d0000b273...",
                features_json=json.dumps({"tempo":tempo,"energy":energy,"valence":valence,"danceability":dance,"loudness":loud,"popularity":pop})
            ))
        await s.commit()

if __name__ == "__main__":
    asyncio.run(main())
