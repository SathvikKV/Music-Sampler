# app/services/providers/spotify_simple.py
from __future__ import annotations
import time
import os
import base64
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.settings import settings

# ---------------------------
# Token: client credentials
# ---------------------------
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

# ---------------------------
# Search (fallback)
# ---------------------------
def _clean_query(q: str) -> str:
    return q.strip()

async def search_tracks(query: str, limit: int = 20, market: str = "US") -> List[Dict[str, Any]]:
    token = await _get_app_token()
    q = _clean_query(query)
    params = {
        "q": q,
        "type": "track",
        "limit": min(max(limit, 1), 50),
        "market": market,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        r.raise_for_status()
        items = r.json().get("tracks", {}).get("items", []) or []
        return [ _track_from_spotify_item(it) for it in items ]

# ---------------------------
# Recommendations (preferred)
# ---------------------------
def _map_mood_to_val(mood: Optional[str]) -> Dict[str, float]:
    # You can tune these to your taste
    if not mood:
        return {}
    mood = mood.lower()
    # examples
    if "night" in mood:
        return {"target_energy": 0.45, "target_valence": 0.35}
    if "chill" in mood:
        return {"target_energy": 0.35, "target_valence": 0.5}
    if "party" in mood or "banger" in mood:
        return {"target_energy": 0.8, "target_valence": 0.7}
    return {}

async def recommend_tracks(seed: Dict[str, Any], limit: int = 20, market: str = "US") -> List[Dict[str, Any]]:
    """
    seed: { query?, genres?, bpm?, energy?, mood? }
    Uses /v1/recommendations with seed_genres and target attributes where possible.
    """
    token = await _get_app_token()

    seed_genres = seed.get("genres") or []
    # Spotify caps seed_genres at <=5
    seed_genres = [g.replace(" ", "-") for g in seed_genres][:5]

    params = {
        "limit": min(max(limit, 1), 50),
        "market": market,
    }

    if seed_genres:
        params["seed_genres"] = ",".join(seed_genres)
    else:
        # if no genre seeds, fall back to keyword-based recs via search-then-recs
        # 1) do a small search
        initial = await search_tracks(seed.get("query", "") or "new music", limit=5, market=market)
        track_ids = [t["id"] for t in initial][:5]
        if track_ids:
            params["seed_tracks"] = ",".join(track_ids)
        else:
            # truly nothing: return empty
            return []

    # apply targets
    mood_params = _map_mood_to_val(seed.get("mood"))
    params.update(mood_params)

    if seed.get("energy") is not None:
        params["target_energy"] = max(0.0, min(1.0, float(seed["energy"])))
    if seed.get("bpm") is not None:
        params["target_tempo"] = int(seed["bpm"])

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            "https://api.spotify.com/v1/recommendations",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        r.raise_for_status()
        items = r.json().get("tracks", []) or []
        return [ _track_from_spotify_item(it) for it in items ]

# ---------------------------
# Mapping helpers
# ---------------------------
def _track_from_spotify_item(it: Dict[str, Any]) -> Dict[str, Any]:
    track_id = it.get("id")
    artists = ", ".join([a.get("name", "") for a in it.get("artists", [])])
    album = it.get("album", {}) or {}
    images = album.get("images", []) or []
    artwork = images[0]["url"] if images else None

    return {
        # canonical id (we use spotify id string as internal for now)
        "id": track_id,
        "provider_track_uri": f"spotify:track:{track_id}" if track_id else None,
        "title": it.get("name"),
        "artist": artists,
        "artwork_url": artwork,
        # Optional extras you may use later
        "duration_ms": it.get("duration_ms"),
        "popularity": it.get("popularity"),
        "album": album.get("name"),
        "album_release_date": album.get("release_date"),
    }

def to_feed_card(t: Dict[str, Any], reason: str) -> Dict[str, Any]:
    full_duration = t.get("duration_ms")  # this comes from Spotify track item
    return {
        "track_id": t["id"],
        "provider": "spotify",
        "provider_track_id": t["provider_track_uri"],
        "title": t["title"],
        "artist": t["artist"],
        "artwork_url": t.get("artwork_url"),
        "preview": {
            "type": "spotify_websdk",
            "start_ms": 0,
            # if Spotify gave us a duration, use that, otherwise fall back to 30s
            "duration_ms": full_duration if full_duration else 30000,
        },
        "tags": [],
        "reason": reason,
    }