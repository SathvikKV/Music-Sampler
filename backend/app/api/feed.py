# app/api/feed.py
from __future__ import annotations

from typing import List, Optional, Any
from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import json
import ast
import logging

from app.services.db import get_db
from app.repositories.sessions import get_session

# our Spotify helpers
from app.services.providers.spotify_simple import (
    search_tracks,
    to_feed_card,
    recommend_tracks,
)
from app.services.providers.spotify_features import get_audio_features
from app.services.providers.spotify_auth import get_app_token

# playlist helpers (the ones we added)
from app.services.providers.spotify_playlists import (
    search_playlists,
    get_playlist_tracks,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class FeedCard(BaseModel):
    track_id: str
    provider: str
    provider_track_id: str
    title: str
    artist: str
    artwork_url: Optional[str] = None
    preview: dict
    tags: List[str] = []
    reason: Optional[str] = None
    meta: Optional[dict] = None


def _coerce_seed(value) -> dict:
    """Accept dict or stringified dict and return dict."""
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        # try JSON first
        try:
            return json.loads(value)
        except Exception:
            # then try python literal
            try:
                v = ast.literal_eval(value)
                return v if isinstance(v, dict) else {}
            except Exception:
                return {}
    return {}


@router.get("/feed", response_model=List[FeedCard])
async def get_feed(
    session_id: str = Query(...),
    user_id: str = Query(...),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    # -------------------------------------------------
    # 1) load session and natural-language seed
    # -------------------------------------------------
    s = await get_session(db, session_id)
    if not s:
      raise HTTPException(status_code=404, detail="Session not found")

    seed = _coerce_seed(getattr(s, "seed_json", {}))
    query = (seed.get("query") or "").strip()
    if not query:
      raise HTTPException(status_code=400, detail="Session is missing a query")

    cards: List[FeedCard] = []
    reason: str = ""
    candidate_tracks: List[dict] = []

    # -------------------------------------------------
    # 2) playlist-first, but NEVER crash if Spotify returns odd data
    # -------------------------------------------------
    got_from_playlists = False
    try:
        playlists = await search_playlists(query, limit=10)
        if playlists:
            # how many playlists to sample from
            max_playlists = max(1, min(len(playlists), max(1, limit // 4)))
            target_total_samples = limit * 2  # we'll dedupe later
            sampled_tracks: List[dict] = []

            for idx, pl in enumerate(playlists[:max_playlists]):
                pl_id = pl.get("id")
                if not pl_id:
                    continue

                remaining_playlists = max_playlists - idx
                remaining_budget = max(0, target_total_samples - len(sampled_tracks))
                per_playlist = max(1, remaining_budget // max(1, remaining_playlists))

                try:
                    trks = await get_playlist_tracks(pl_id, limit=per_playlist)
                except Exception as e:
                    logger.warning("playlist tracks failed for %s: %s", pl_id, e)
                    continue

                if not trks:
                    continue

                for t in trks:
                    # mark where it came from
                    t["_src_playlist"] = pl.get("name")
                    sampled_tracks.append(t)

            if sampled_tracks:
                candidate_tracks = sampled_tracks
                got_from_playlists = True
                if max_playlists > 1:
                    reason = f"From playlists matching “{query}”"
                else:
                    reason = f"From playlist “{sampled_tracks[0].get('_src_playlist') or query}”"
    except Exception as e:
        # playlist branch failed → we’ll just fall through to recs/search
        logger.warning("playlist-first branch failed: %s", e)

    # -------------------------------------------------
    # 3) if no playlist tracks, try recommendations (LLM-ish seed → recs)
    # -------------------------------------------------
    if not candidate_tracks:
        try:
            recs = await recommend_tracks(seed, limit=limit)
            if recs:
                candidate_tracks = recs
                reason = f"Because you asked for “{query}”"
        except Exception as e:
            logger.warning("recommend_tracks failed: %s", e)

    # -------------------------------------------------
    # 4) if still nothing, do plain search
    # -------------------------------------------------
    if not candidate_tracks:
        try:
            sr = await search_tracks(query, limit=limit)
            candidate_tracks = sr or []
            reason = f"Search results for “{query}”"
        except Exception as e:
            logger.error("search_tracks failed completely: %s", e)
            # at this point, just return empty – 200 OK
            return []

    if not candidate_tracks:
        return []

    # -------------------------------------------------
    # 5) try to get audio features in bulk; don't fail feed if it errors
    # -------------------------------------------------
    feats_by_id: dict[str, dict] = {}
    try:
        app_token = await get_app_token()
    except Exception:
        app_token = None

    if app_token:
        try:
            ids_for_feats = [t.get("id") for t in candidate_tracks if t.get("id")]
            if ids_for_feats:
                feats_by_id = await get_audio_features(ids_for_feats, app_token)
        except Exception as e:
            logger.warning("audio-features failed: %s", e)
            feats_by_id = {}

    # -------------------------------------------------
    # 6) build response cards, dedupe, defensive artist parsing
    # -------------------------------------------------
    seen_ids: set[str] = set()
    for t in candidate_tracks:
        tid = t.get("id")
        if not tid:
            continue
        if tid in seen_ids:
            continue
        seen_ids.add(tid)

        base = to_feed_card(t, reason)

        # attach features
        f = feats_by_id.get(tid)
        features = None
        if f:
            features = {
                "energy": f.get("energy"),
                "valence": f.get("valence"),
                "tempo": f.get("tempo"),
                "instrumentalness": f.get("instrumentalness"),
            }

        # robust artist extraction
        artist_name = base.get("artist")
        artist_id = None

        raw_artists: Any = (
            t.get("artists_raw")
            or t.get("artists")
            or []
        )

        # normalize to a list
        if isinstance(raw_artists, (dict, str)):
            raw_artists = [raw_artists]

        if isinstance(raw_artists, list) and raw_artists:
            first = raw_artists[0]
            if isinstance(first, dict):
                artist_id = first.get("id")
                artist_name = first.get("name") or artist_name
            elif isinstance(first, str):
                artist_name = first or artist_name

        # discovery score
        pop = t.get("popularity")
        try:
            pop_int = int(pop) if pop is not None else 50
        except Exception:
            pop_int = 50
        discovery = max(0, 100 - pop_int)

        meta = {
            "features": features,
            "discovery_score": discovery,
            "artist": {
                "id": artist_id,
                "name": artist_name,
                "genres": t.get("artist_genres") or [],
                "popularity": pop_int,
            },
        }

        base["meta"] = meta
        cards.append(FeedCard(**base))

        if len(cards) >= limit:
            break

    return cards
