# app/api/playback.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from app.services.auth.spotify_oauth import get_fresh_access_token_for_user

router = APIRouter()

@router.get("/playback/token")
async def get_playback_token(user_id: str = Query(...)):
    """
    Return a short-lived Spotify access token for Web Playback SDK.
    Assumes OAuth tokens are stored in oauth_tokens table.
    """
    token = await get_fresh_access_token_for_user(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="Spotify not linked")
    return {"token": token}
