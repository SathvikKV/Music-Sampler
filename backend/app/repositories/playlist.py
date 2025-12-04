# backend/app/repositories/playlists.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, delete
from app.models.playlist import Playlist, PlaylistTrack
from app.models.track import Track

async def create_playlist(db: AsyncSession, user_id: str, name: str, kind: str = "vibe") -> Playlist:
    p = Playlist(user_id=user_id, name=name, kind=kind)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p

async def add_track(db: AsyncSession, playlist_id: str, track_id: str) -> None:
    await db.execute(
        insert(PlaylistTrack).values(playlist_id=playlist_id, track_id=track_id).prefix_with("ON CONFLICT DO NOTHING")
    )
    await db.commit()

async def get_playlists(db: AsyncSession, user_id: str) -> list[Playlist]:
    res = await db.execute(select(Playlist).where(Playlist.user_id == user_id))
    return list(res.scalars().all())

async def get_playlist_tracks(db: AsyncSession, playlist_id: str) -> list[Track]:
    q = (
        select(Track)
        .join(PlaylistTrack, PlaylistTrack.track_id == Track.id)
        .where(PlaylistTrack.playlist_id == playlist_id)
    )
    res = await db.execute(q)
    return list(res.scalars().all())

async def remove_track(db: AsyncSession, playlist_id: str, track_id: str) -> None:
    await db.execute(
        delete(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id, PlaylistTrack.track_id == track_id
        )
    )
    await db.commit()
