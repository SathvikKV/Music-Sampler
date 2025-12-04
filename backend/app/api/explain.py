# app/api/explain.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends, Path
from pydantic import BaseModel
import httpx
import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.providers.spotify_auth import get_app_token
from app.services.search import search_artist_news
from app.services.db import get_db
from app.models.playlist import Playlist, PlaylistTrack

router = APIRouter()

class ExplainTrackIn(BaseModel):
    provider: str = "spotify"
    track_id: str
    lyrics: str | None = None

class ExplainTrackOut(BaseModel):
    track_id: str
    explanation: dict
    raw: dict | None = None

class PlaylistExplanationOut(BaseModel):
    playlist_id: str
    explanation: dict

SPOTIFY_BASE = "https://api.spotify.com/v1"

async def _fetch_spotify_track(track_id: str, token: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SPOTIFY_BASE}/tracks/{track_id}", headers={"Authorization": f"Bearer {token}"})
        r.raise_for_status()
        return r.json()

async def _fetch_spotify_artist(artist_id: str, token: str) -> dict | None:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SPOTIFY_BASE}/artists/{artist_id}", headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            return None
        return r.json()

async def _fetch_spotify_features(track_id: str, token: str) -> dict | None:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SPOTIFY_BASE}/audio-features/{track_id}", headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            return None
        return r.json()

def _build_prompt(track: dict, artist: dict | None, features: dict | None, lyrics: str | None, news: list[str] | None) -> str:
    title = track.get("name")
    artist_name = ", ".join(a.get("name", "") for a in track.get("artists", [])) or (artist or {}).get("name", "")
    popularity = track.get("popularity")
    dur_ms = track.get("duration_ms")
    dur_min = (dur_ms or 0) / 60000.0

    energy = (features or {}).get("energy")
    valence = (features or {}).get("valence")
    tempo = (features or {}).get("tempo")

    parts: list[str] = [
        "You are an expert music analyst who explains songs in detail.",
        f"Track title: {title}",
        f"Artist: {artist_name}",
        f"Duration (min): {dur_min:.2f}",
        f"Spotify popularity: {popularity}",
    ]

    if energy is not None or valence is not None or tempo is not None:
        parts.append("Audio features:")
        if energy is not None:
            parts.append(f"- energy: {energy}")
        if valence is not None:
            parts.append(f"- valence: {valence}")
        if tempo is not None:
            parts.append(f"- tempo: {tempo}")

    if lyrics:
        parts.append("Lyrics for deeper semantic analysis:")
        parts.append(lyrics)

    if news:
        parts.append("Recent Artist News / Context:")
        for n in news:
            parts.append(f"- {n}")

    # tell it exactly what to return
    parts.append(
        """Return ONLY JSON with this shape:
{
  "summary": "2-4 sentences about THIS specific song (not the artist generally). Mention mood & sonic character.",
  "lyric_themes": ["main themes present in lyrics or inferred from title"],
  "mood": ["adjectives like 'moody', 'uplifting', 'nocturnal'"],
  "best_for": ["scenarios where this fits: e.g. 'late night driving'"],
  "sonic_notes": ["tempo, energy, production details, vocals vs instrumental"],
  "because": ["short bullet reasons tied to audio features / popularity / lyrics"],
  "artist_context": "1-2 sentences incorporating recent news or background info if relevant"
}
"""
    )
    return "\n".join(parts)

def _build_playlist_prompt(playlist_name: str, tracks: list[dict]) -> str:
    parts = [
        "You are an expert music curator.",
        f"Analyze this playlist: '{playlist_name}'",
        "Tracks:"
    ]
    for t in tracks[:50]: # limit to 50 to avoid token limits
        parts.append(f"- {t['title']} by {t['artist']}")
    
    parts.append(
        """
Return ONLY JSON with this shape:
{
  "vibe": "Short description of the overall mood and atmosphere.",
  "genres": ["Dominant genre 1", "Dominant genre 2"],
  "consistency": 8, // 1-10 score on how well tracks fit together
  "best_for": ["Activity 1", "Activity 2"],
  "analysis": "2-3 sentences explaining why these tracks work together (or don't)."
}
"""
    )
    return "\n".join(parts)

async def _call_llm(prompt: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        # fallback
        return {
            "summary": "Energetic track with modern production and a strong hook.",
            "lyric_themes": ["relationships", "desire", "power dynamic"],
            "mood": ["energetic", "confident"],
            "best_for": ["gym", "driving", "hype playlists"],
            "sonic_notes": ["mid-to-high energy", "danceable tempo"],
            "because": ["energy high", "tempo supports movement", "popular artist"],
            "artist_context": "Artist is popular and active."
        }

    # call OpenAI
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a helpful music analyst."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
            },
        )
    if r.status_code != 200:
        # fail soft
        return {
            "summary": "Could not fetch a rich explanation right now.",
            "lyric_themes": [],
            "mood": [],
            "best_for": [],
            "sonic_notes": [],
            "because": [],
            "artist_context": ""
        }

    data = r.json()
    content = data["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except Exception:
        return {
            "summary": content,
            "lyric_themes": [],
            "mood": [],
            "best_for": [],
            "sonic_notes": [],
            "because": [],
            "artist_context": ""
        }

@router.post("/explain/track", response_model=ExplainTrackOut)
async def explain_track(payload: ExplainTrackIn):
    if payload.provider != "spotify":
        raise HTTPException(status_code=400, detail="Only spotify supported right now")

    sp_id = payload.track_id.split(":")[-1]

    token = await get_app_token()

    track = await _fetch_spotify_track(sp_id, token)
    artist_id = track.get("artists", [{}])[0].get("id")
    artist = await _fetch_spotify_artist(artist_id, token) if artist_id else None
    features = await _fetch_spotify_features(sp_id, token)
    
    # Fetch news
    artist_name = (artist or {}).get("name")
    news = []
    if artist_name:
        news = await search_artist_news(artist_name)

    prompt = _build_prompt(track, artist, features, payload.lyrics, news)
    llm_resp = await _call_llm(prompt)

    return ExplainTrackOut(
        track_id=payload.track_id,
        explanation=llm_resp,
        raw={
            "track": track,
            "audio_features": features or {},
            "artist": artist or {},
            "news": news
        },
    )

@router.post("/explain/playlist/{playlist_id}", response_model=PlaylistExplanationOut)
async def explain_playlist(
    playlist_id: str = Path(...),
    db: AsyncSession = Depends(get_db)
):
    # Fetch playlist and tracks
    res_pl = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    pl = res_pl.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    res_tracks = await db.execute(
        select(PlaylistTrack).where(PlaylistTrack.playlist_id == playlist_id)
    )
    pts = res_tracks.scalars().all()
    
    if not pts:
         return PlaylistExplanationOut(
            playlist_id=playlist_id,
            explanation={
                "vibe": "Empty playlist",
                "genres": [],
                "consistency": 0,
                "best_for": [],
                "analysis": "Add some tracks to get an analysis."
            }
        )

    tracks_data = [{"title": pt.title, "artist": pt.artist} for pt in pts]
    
    prompt = _build_playlist_prompt(pl.name, tracks_data)
    llm_resp = await _call_llm(prompt)
    
    return PlaylistExplanationOut(
        playlist_id=playlist_id,
        explanation=llm_resp
    )
