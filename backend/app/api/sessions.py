# app/api/sessions.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json
import httpx

from app.services.db import get_db
from app.repositories.sessions import create_session, get_session
from app.services.providers.spotify_auth import get_app_token

router = APIRouter()


# ----------------------------
# Create (natural-language) session
# ----------------------------
class CreateSessionIn(BaseModel):
    user_id: str
    query: Optional[str] = None


class CreateSessionOut(BaseModel):
    id: str
    user_id: str
    seed: dict


@router.post("/sessions", response_model=CreateSessionOut)
async def create_session_api(payload: CreateSessionIn, db: AsyncSession = Depends(get_db)):
    user_query = (payload.query or "").strip()

    # lazy import so app can start even if nl_seed isn’t present
    try:
      from app.services.nl_seed import parse_seed  # type: ignore
    except Exception:
      parse_seed = None  # type: ignore

    # try to build a nice seed, but don’t crash
    seed: dict
    if parse_seed:
        try:
            parsed = await parse_seed(user_query)
            if isinstance(parsed, dict):
                seed = parsed
            else:
                seed = {"query": user_query}
        except Exception:
            seed = {"query": user_query}
    else:
        # module missing → simple seed
        seed = {"query": user_query}

    # create DB session row
    s = await create_session(db, user_id=payload.user_id, seed_json=seed)

    # normalize for response
    try:
        seed_obj = json.loads(s.seed_json or "{}")
    except Exception:
        seed_obj = s.seed_json if isinstance(s.seed_json, dict) else {}

    return CreateSessionOut(id=s.id, user_id=s.user_id, seed=seed_obj)


# ----------------------------
# Branch session from a specific track (e.g., “more like this”)
# ----------------------------
class BranchIn(BaseModel):
    user_id: str
    from_session_id: str
    provider_track_id: str  # e.g. "spotify:track:6o5i..."


class BranchOut(BaseModel):
    id: str
    user_id: str
    seed: dict


@router.post("/sessions/branch", response_model=BranchOut)
async def branch_session(payload: BranchIn, db: AsyncSession = Depends(get_db)):
    # ensure source session exists
    src = await get_session(db, payload.from_session_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source session not found")

    # Parse Spotify ID from URI
    sp_uri = payload.provider_track_id
    sp_id = sp_uri.split(":")[-1] if ":" in sp_uri else sp_uri

    # try to get app token, but don’t crash if Spotify creds aren’t set
    try:
        token = await get_app_token()
    except Exception:
        token = None

    genres: list[str] = []
    bpm_val: int | None = None
    energy_val: float | None = None
    fallback_name = "similar"

    if token:
        async with httpx.AsyncClient(timeout=15) as c:
            # Track detail
            tr_resp = await c.get(
                f"https://api.spotify.com/v1/tracks/{sp_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if tr_resp.status_code == 200:
                tr = tr_resp.json()
                fallback_name = tr.get("name") or fallback_name

                # artist → genres
                first_artist_id = tr.get("artists", [{}])[0].get("id")
                if first_artist_id:
                    ar_resp = await c.get(
                        f"https://api.spotify.com/v1/artists/{first_artist_id}",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if ar_resp.status_code == 200:
                        ar = ar_resp.json()
                        genres = (ar.get("genres") or [])[:3]

                # audio features
                af_resp = await c.get(
                    "https://api.spotify.com/v1/audio-features",
                    params={"ids": sp_id},
                    headers={"Authorization": f"Bearer {token}"},
                )
                if af_resp.status_code == 200:
                    af = af_resp.json()
                    feats = (af.get("audio_features") or [{}])[0]
                    if feats:
                        tempo_val = feats.get("tempo")
                        if tempo_val:
                            bpm_val = int(round(tempo_val))
                        energy_val = feats.get("energy")

    # build seed for branched session
    seed = {
        "query": fallback_name,
        "genres": genres or None,
        "bpm": bpm_val,
        "energy": energy_val,
        "mood": None,
        "from_track": sp_id,
    }

    s = await create_session(db, user_id=payload.user_id, seed_json=seed)

    # normalize for response
    try:
        seed_obj = json.loads(s.seed_json or "{}")
    except Exception:
        seed_obj = s.seed_json if isinstance(s.seed_json, dict) else {}

    return BranchOut(id=s.id, user_id=s.user_id, seed=seed_obj)
