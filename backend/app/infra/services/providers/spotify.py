from typing import Optional

async def resolve_preview(track) -> Optional[dict]:
    if getattr(track, "provider", "") == "spotify":
        return {
            "provider": "spotify",
            "id": track.provider_track_id,
            "preview": {
                "type": "spotify_websdk",
                "url": None,
                "start_ms": 30000,
                "duration_ms": 20000
            }
        }
    return None
