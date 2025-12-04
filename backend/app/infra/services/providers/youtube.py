from typing import Optional

async def resolve_preview(track) -> Optional[dict]:
    if getattr(track, "provider", "") == "youtube":
        return {
            "provider": "youtube",
            "id": track.provider_track_id,
            "preview": {
                "type": "youtube_embed",
                "url": track.provider_track_id,
                "start_ms": 10000,
                "duration_ms": 20000
            }
        }
    return None
