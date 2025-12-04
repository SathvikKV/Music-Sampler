from __future__ import annotations
import base64
import httpx
from app.settings import settings

_app_token: str | None = None

async def get_app_token() -> str:
    """
    Client-credentials token for public endpoints (e.g., audio-features).
    Does not require user auth.
    """
    global _app_token
    if _app_token:
        return _app_token

    auth = base64.b64encode(
        f"{settings.SPOTIFY_CLIENT_ID}:{settings.SPOTIFY_CLIENT_SECRET}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        r.raise_for_status()
        data = r.json()
        _app_token = data["access_token"]
        return _app_token
