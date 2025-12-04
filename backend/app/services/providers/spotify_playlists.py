# app/services/providers/spotify_playlists.py
from __future__ import annotations
from typing import Any, Dict, List, Optional
import httpx
import time
import base64

from app.settings import settings

# reuse client-credentials (same pattern as spotify_simple)
_app_token: Optional[str] = None
_app_token_exp: float = 0.0


async def _get_app_token() -> str:
    global _app_token, _app_token_exp
    now = time.time()
    if _app_token and now < _app_token_exp - 30:
      return _app_token

    auth = base64.b64encode(
        f"{settings.SPOTIFY_CLIENT_ID}:{settings.SPOTIFY_CLIENT_SECRET}".encode("utf-8")
    ).decode("utf-8")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://accounts.spotify.com/api/token",
            headers={"Authorization": f"Basic {auth}"},
            data={"grant_type": "client_credentials"},
        )
        resp.raise_for_status()
        data = resp.json()
        _app_token = data["access_token"]
        _app_token_exp = now + int(data.get("expires_in", 3600))
        return _app_token


async def search_playlists(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search Spotify for playlists matching the query.
    We'll use the items' IDs to fetch tracks.
    """
    token = await _get_app_token()
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "q": query,
                "type": "playlist",
                "limit": min(max(limit, 1), 10),
            },
        )
        r.raise_for_status()
        return r.json().get("playlists", {}).get("items", []) or []


async def get_playlist_tracks(playlist_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch tracks from a playlist. We only need basic track info.
    """
    token = await _get_app_token()
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks",
            headers={"Authorization": f"Bearer {token}"},
            params={"limit": min(max(limit, 1), 100)},
        )
        r.raise_for_status()
        items = r.json().get("items", []) or []
        tracks: List[Dict[str, Any]] = []
        for it in items:
            tr = it.get("track")
            if not tr:
                continue
            # normalize a bit so it looks like search_tracks output
            artists = ", ".join([a.get("name", "") for a in tr.get("artists", [])])
            album = tr.get("album", {}) or {}
            images = album.get("images", []) or []
            artwork = images[0]["url"] if images else None
            tracks.append(
                {
                    "id": tr.get("id"),
                    "provider_track_uri": f"spotify:track:{tr.get('id')}" if tr.get("id") else None,
                    "title": tr.get("name"),
                    "artist": artists,
                    "artwork_url": artwork,
                    "duration_ms": tr.get("duration_ms"),
                    "popularity": tr.get("popularity"),
                    "album": album.get("name"),
                    "album_release_date": album.get("release_date"),
                    # keep original artists list for later enrichment
                    "artists_raw": tr.get("artists", []),
                }
            )
        return tracks
