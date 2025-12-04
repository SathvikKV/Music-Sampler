# app/scripts/seed_playlists.py
import asyncio
import os
import sys

# Add backend directory to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))

from app.services import db as db_service
from app.services.db import init_engine
from app.models.playlist import Playlist, PlaylistTrack
from app.models.track import Track
from app.models.base import gen_uuid
from sqlalchemy import select

# Sample Data
PLAYLISTS = [
    {
        "name": "Late Night Drive",
        "kind": "vibe",
        "tracks": [
            {"id": "spotify:track:0VjIjW4GlUZAMYd2vXMi3b", "title": "Blinding Lights", "artist": "The Weeknd", "provider": "spotify", "provider_id": "0VjIjW4GlUZAMYd2vXMi3b"},
            {"id": "spotify:track:6i0V12jOa3mr6uu4WYhUBr", "title": "Midnight City", "artist": "M83", "provider": "spotify", "provider_id": "6i0V12jOa3mr6uu4WYhUBr"},
            {"id": "spotify:track:4cOdK2wGLETKBW3PvgPWqT", "title": "Starboy", "artist": "The Weeknd", "provider": "spotify", "provider_id": "4cOdK2wGLETKBW3PvgPWqT"},
        ]
    },
    {
        "name": "Gym Hype",
        "kind": "activity",
        "tracks": [
            {"id": "spotify:track:51FpzuGkRYXFgsE2zS3qAR", "title": "Stronger", "artist": "Kanye West", "provider": "spotify", "provider_id": "51FpzuGkRYXFgsE2zS3qAR"},
            {"id": "spotify:track:2KH16WveQVOLQS45tQQRnz", "title": "Eye of the Tiger", "artist": "Survivor", "provider": "spotify", "provider_id": "2KH16WveQVOLQS45tQQRnz"},
            {"id": "spotify:track:1e1JKLEDKP7hEQzJfNAgPl", "title": "Till I Collapse", "artist": "Eminem", "provider": "spotify", "provider_id": "1e1JKLEDKP7hEQzJfNAgPl"},
        ]
    },
    {
        "name": "Chill Sunday",
        "kind": "vibe",
        "tracks": [
            {"id": "spotify:track:0ofHAoxe9vBkTCp2UQIavz", "title": "Dreams", "artist": "Fleetwood Mac", "provider": "spotify", "provider_id": "0ofHAoxe9vBkTCp2UQIavz"},
            {"id": "spotify:track:3S0OXQeoh0w6AY8WQVckRW", "title": "Sweater Weather", "artist": "The Neighbourhood", "provider": "spotify", "provider_id": "3S0OXQeoh0w6AY8WQVckRW"},
        ]
    }
]

async def seed():
    print("Initializing DB...")
    await init_engine()
    
    async with db_service.SessionLocal() as db:
        # For now, we'll just use a hardcoded user_id or try to find one.
        # Since we don't have a user table easily accessible or known, let's just use a dummy UUID.
        # Or better, let's check if there are any playlists and use that user_id, or just generate one.
        # The frontend likely uses a specific user_id or "me".
        # Let's use a fixed UUID so the user can easily "login" as this user if needed, 
        # or we assume the app handles user creation.
        # Actually, let's try to find a user from existing playlists if any.
        
        res = await db.execute(select(Playlist))
        existing_pl = res.scalars().first()
        if existing_pl:
            user_id = existing_pl.user_id
            print(f"Found existing user_id: {user_id}")
        else:
            user_id = "test-user-id"
            print(f"No existing playlists, using default user_id: {user_id}")

        for p_data in PLAYLISTS:
            # Create Playlist
            pl = Playlist(
                id=gen_uuid(),
                user_id=user_id,
                name=p_data["name"],
                kind=p_data["kind"]
            )
            db.add(pl)
            print(f"Created playlist: {pl.name}")
            
            # Add Tracks
            for t_data in p_data["tracks"]:
                # Ensure Track exists
                res_t = await db.execute(select(Track).where(Track.id == t_data["id"]))
                track = res_t.scalar_one_or_none()
                if not track:
                    track = Track(
                        id=t_data["id"],
                        provider=t_data["provider"],
                        provider_track_id=t_data["provider_id"],
                        title=t_data["title"],
                        artist=t_data["artist"],
                        artwork_url=None # We don't have artwork for now
                    )
                    db.add(track)
                
                # Add to PlaylistTrack
                pt = PlaylistTrack(
                    id=gen_uuid(),
                    playlist_id=pl.id,
                    track_id=t_data["id"],
                    provider=t_data["provider"],
                    provider_track_id=t_data["provider_id"],
                    title=t_data["title"],
                    artist=t_data["artist"],
                    artwork_url=None
                )
                db.add(pt)
            
        await db.commit()
        print("Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed())
