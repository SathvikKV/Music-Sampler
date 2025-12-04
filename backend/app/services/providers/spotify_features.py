# app/services/providers/spotify_features.py
import httpx
async def get_audio_features(track_ids: list[str], token: str) -> dict[str, dict]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
          "https://api.spotify.com/v1/audio-features",
          params={"ids":",".join(track_ids[:100])},
          headers={"Authorization": f"Bearer {token}"}
        )
        r.raise_for_status()
        feats = r.json().get("audio_features", []) or []
        return { f["id"]: f for f in feats if f }
