# app/api/playlists.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession
import time

from app.services.db import get_db
from app.models.playlist import Playlist, PlaylistTrack
from app.models.track import Track
from app.models.base import gen_uuid

router = APIRouter()


# ---------- schemas ----------
class PlaylistOut(BaseModel):
    id: str
    user_id: str
    name: str
    kind: str = "vibe"

    class Config:
        from_attributes = True


class PlaylistDetailOut(PlaylistOut):
    tracks: list[dict]


class CreatePlaylistIn(BaseModel):
    user_id: str
    name: str
    kind: Optional[str] = "vibe"


class AddTrackIn(BaseModel):
    track_id: str
    provider: str
    provider_track_id: str
    title: Optional[str] = None
    artist: Optional[str] = None
    artwork_url: Optional[str] = None


# ---------- helpers ----------
async def _ensure_track_exists(
    db: AsyncSession,
    *,
    track_id: str,
    provider: str,
    provider_track_id: str,
    title: str | None,
    artist: str | None,
    artwork_url: str | None,
) -> None:
    """
    Ensures the track exists in the database before adding it to a playlist.
    If the track is missing, a minimal record is created.
    """
    res = await db.execute(select(Track).where(Track.id == track_id))
    existing = res.scalar_one_or_none()
    if existing:
      return

    t = Track(
        id=track_id,
        provider=provider,
        provider_track_id=provider_track_id,
        title=title or "",
        artist=artist or "",
        artwork_url=artwork_url,
    )
    db.add(t)
    await db.flush()


# ---------- routes ----------

@router.get("/playlists", response_model=list[PlaylistOut])
async def list_playlists(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Playlist).where(Playlist.user_id == user_id).order_by(Playlist.created_at)
    )
    rows = res.scalars().all()
    return rows


@router.post("/playlists", response_model=PlaylistOut)
async def create_playlist(payload: CreatePlaylistIn, db: AsyncSession = Depends(get_db)):
    pl = Playlist(
        id=gen_uuid(),
        user_id=payload.user_id,
        name=payload.name,
        kind=payload.kind or "vibe",
    )
    db.add(pl)
    await db.commit()
    await db.refresh(pl)
    return pl


@router.get("/playlists/{playlist_id}", response_model=PlaylistDetailOut)
async def get_playlist(
    playlist_id: str = Path(...),
    db: AsyncSession = Depends(get_db),
):
    # get playlist
    res_pl = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    pl = res_pl.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # get tracks
    res_tracks = await db.execute(
        select(PlaylistTrack).where(PlaylistTrack.playlist_id == playlist_id)
    )
    pts = res_tracks.scalars().all()

    tracks = []
    for pt in pts:
        tracks.append(
            {
                "track_id": pt.track_id,
                "provider": pt.provider,
                "provider_track_id": pt.provider_track_id,
                "title": pt.title,
                "artist": pt.artist,
                "artwork_url": pt.artwork_url,
                "added_at": pt.created_at,
            }
        )

    return PlaylistDetailOut(
        id=pl.id,
        user_id=pl.user_id,
        name=pl.name,
        kind=pl.kind,
        tracks=tracks,
    )


@router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(
    playlist_id: str,
    payload: AddTrackIn,
    db: AsyncSession = Depends(get_db),
):
    # check playlist
    res_pl = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    pl = res_pl.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # 1) ensure track exists in tracks
    await _ensure_track_exists(
        db,
        track_id=payload.track_id,
        provider=payload.provider,
        provider_track_id=payload.provider_track_id,
        title=payload.title,
        artist=payload.artist,
        artwork_url=payload.artwork_url,
    )

    # 2) insert into playlist_tracks (avoid duplicates)
    res_existing = await db.execute(
        select(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == payload.track_id,
        )
    )
    existing = res_existing.scalar_one_or_none()
    if not existing:
        pt = PlaylistTrack(
            id=gen_uuid(),
            playlist_id=playlist_id,
            track_id=payload.track_id,
            provider=payload.provider,
            provider_track_id=payload.provider_track_id,
            title=payload.title,
            artist=payload.artist,
            artwork_url=payload.artwork_url,
        )
        db.add(pt)

    await db.commit()
    return {"ok": True}


@router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: str,
    track_id: str,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == track_id,
        )
    )
    pt = res.scalar_one_or_none()
    if not pt:
        raise HTTPException(status_code=404, detail="Track not found in playlist")

    await db.delete(pt)
    await db.commit()
    return {"ok": True}
