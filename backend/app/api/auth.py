# app/api/auth.py
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
import json, time, uuid

from app.services.db import get_db
from app.services.auth.spotify_oauth import exchange_code_for_token, build_authorize_url
from app.models.user import User
from app.models.oauth import OAuthToken
from app.settings import settings

# ✅ define the router (mounted under /auth in main.py → final path: /auth/spotify/...)
router = APIRouter(prefix="/spotify")

@router.get("/start")
async def start(user_id: str):
    # pass user_id in state so callback can look it up
    state = json.dumps({"user_id": user_id})
    return {"authorize_url": build_authorize_url(state=state)}

@router.get("/callback", response_class=HTMLResponse)
async def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    user_id: str | None = None,   # dev fallback
    db: AsyncSession = Depends(get_db),
):
    if not code:
        raise HTTPException(400, "Missing code")

    uid = None
    if state:
        try:
            uid = str(json.loads(state).get("user_id") or "")
        except Exception:
            if settings.APP_ENV == "dev" and user_id:
                uid = user_id
            else:
                raise HTTPException(400, "Invalid state")
    if not uid:
        if settings.APP_ENV == "dev" and user_id:
            uid = user_id
        else:
            raise HTTPException(400, "Missing user context")

    user = await db.get(User, uid)
    if not user:
        raise HTTPException(400, f"Unknown user_id '{uid}'")

    try:
        tok = await exchange_code_for_token(code)
    except Exception as e:
        raise HTTPException(400, f"Token exchange failed: {type(e).__name__}")

    now = int(time.time())
    expires_at = now + int(tok.get("expires_in", 3600))

    # upsert token
    await db.execute(
        sa.delete(OAuthToken).where(
            (OAuthToken.user_id == uid) & (OAuthToken.provider == "spotify")
        )
    )
    await db.execute(
        sa.insert(OAuthToken).values(
            id=str(uuid.uuid4()),
            user_id=uid,
            provider="spotify",
            access_token=tok["access_token"],
            refresh_token=tok.get("refresh_token"),
            expires_at=expires_at,
            scope=tok.get("scope"),
        )
    )
    await db.commit()

    return """
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Spotify linked</title></head>
  <body style="font-family: system-ui; padding: 24px;">
    <h2>✅ Spotify linked</h2>
    <p>You can close this tab and return to the app.</p>
    <script>setTimeout(()=>window.close(), 1500)</script>
  </body>
</html>
"""
