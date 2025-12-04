# app/services/auth/spotify_oauth.py
import base64, time, json
import httpx
from fastapi import Response, HTTPException
from app.settings import settings
from urllib.parse import urlencode, quote

SPOTIFY_AUTH = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token"
SCOPE = "user-read-email user-read-private streaming user-modify-playback-state user-read-playback-state"

def build_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.SPOTIFY_REDIRECT_URI,  # must match dashboard exactly
        "scope": SCOPE,
        "show_dialog": "false",
        "state": state,
    }
    # Proper URL-encoding
    return f"{SPOTIFY_AUTH}?{urlencode(params, quote_via=quote)}"

async def exchange_code_for_token(code: str) -> dict:
    """
    Authorization Code flow with client secret (server-to-server). If Spotify rejects,
    raise 400 with Spotify's JSON so we can see the real reason.
    """
    basic = base64.b64encode(
        f"{settings.SPOTIFY_CLIENT_ID}:{settings.SPOTIFY_CLIENT_SECRET}".encode()
    ).decode()

    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.SPOTIFY_REDIRECT_URI,  # must match exactly what was used at authorize step
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            SPOTIFY_TOKEN,
            data=form,
            headers={
                "Authorization": f"Basic {basic}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )

    if r.status_code != 200:
        # Bubble up Spotify's message so we can see if it's invalid_client/invalid_grant/etc
        detail = {"status": r.status_code}
        try:
            detail["body"] = r.json()
        except Exception:
            detail["body"] = r.text
        raise HTTPException(status_code=400, detail=detail)

    payload = r.json()
    payload["obtained_at"] = int(time.time())
    return payload

def store_tokens_cookie(response: Response, tokens: dict):
    # Dev convenience only; real app stores in DB.
    response.set_cookie(
        key="sp_oauth",
        value=str(tokens.get("access_token", "")),
        httponly=True,
        secure=False,  # True in prod
        samesite="lax",
        max_age=3600,
    )


# ---------------------------
# DB-backed token management
# ---------------------------

async def save_tokens_to_db(user_id: str, tokens: dict) -> None:
    """
    Insert or update Spotify tokens in oauth_tokens table.
    Lazy-imports to avoid circulars at app startup.
    """
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.services.db import SessionLocal
    from app.models.oauth import OAuthToken

    assert SessionLocal is not None, "DB not initialized"
    async with SessionLocal() as db:  # type: AsyncSession
        res = await db.execute(
            select(OAuthToken).where(
                OAuthToken.user_id == user_id, OAuthToken.provider == "spotify"
            )
        )
        row = res.scalar_one_or_none()
        expires_at = int(time.time()) + int(tokens.get("expires_in", 3600))

        if row:
            row.access_token = tokens["access_token"]
            row.refresh_token = tokens.get("refresh_token", row.refresh_token)
            row.expires_at = expires_at
            row.scope = tokens.get("scope", row.scope)
        else:
            row = OAuthToken(
                id=f"sp-{user_id}",
                user_id=user_id,
                provider="spotify",
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                expires_at=expires_at,
                scope=tokens.get("scope"),
            )
            db.add(row)
        await db.commit()


async def _refresh_token(db, row) -> str | None:
    """
    Refresh a Spotify access token using the stored refresh_token.
    Lazy-imports to keep module safe at import time.
    """
    if not row.refresh_token:
        return None

    basic = base64.b64encode(
        f"{settings.SPOTIFY_CLIENT_ID}:{settings.SPOTIFY_CLIENT_SECRET}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=15) as client:
        data = {"grant_type": "refresh_token", "refresh_token": row.refresh_token}
        r = await client.post(
            SPOTIFY_TOKEN, data=data, headers={"Authorization": f"Basic {basic}"}
        )
        if r.status_code != 200:
            return None

        payload = r.json()
        row.access_token = payload["access_token"]
        if "refresh_token" in payload:
            row.refresh_token = payload["refresh_token"]
        if "expires_in" in payload:
            row.expires_at = int(time.time()) + int(payload["expires_in"])
        await db.commit()
        return row.access_token


async def get_fresh_access_token_for_user(user_id: str) -> str | None:
    """
    Fetch a valid Spotify access token for playback; refresh if close to expiry.
    Lazy-imports to avoid import-time side effects.
    """
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.services.db import SessionLocal
    from app.models.oauth import OAuthToken

    assert SessionLocal is not None, "DB not initialized"
    async with SessionLocal() as db:  # type: AsyncSession
        res = await db.execute(
            select(OAuthToken).where(
                OAuthToken.user_id == user_id, OAuthToken.provider == "spotify"
            )
        )
        row = res.scalar_one_or_none()
        if not row:
            return None

        now = int(time.time())
        # if >60s remaining, use as-is
        if row.expires_at and row.expires_at - now > 60:
            return row.access_token

        # else try refresh
        new_token = await _refresh_token(db, row)
        return new_token or row.access_token
