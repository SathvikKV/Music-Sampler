from typing import Optional

async def resolve_preview(track) -> Optional[dict]:
    if getattr(track, "provider", "") == "audius":
        return {
            "provider": "audius",
            "id": track.provider_track_id,
            "preview": {
                "type": "audius_stream",
                "url": f"https://audius.example/stream/{track.provider_track_id}",
                "start_ms": 0,
                "duration_ms": 20000
            }
        }
    return None
