from __future__ import annotations
from typing import Optional, Dict, Any
from app.services.recsys.clip_selector import choose_clip_window

async def resolve_preview(track) -> Optional[Dict[str, Any]]:
    if track.provider != "audius":
        return None
    # For Audius, we typically have a direct stream URL.
    # Frontend <audio> element will seek and stop with a timer.
    if not track.stream_url:
        return None
    start_ms, duration_ms = choose_clip_window(track.duration_ms, track.features_json)
    return {
        "provider": "audius",
        "id": track.provider_track_id,
        "preview": {
            "type": "audius_stream",
            "url": track.stream_url,
            "start_ms": start_ms,
            "duration_ms": duration_ms,
        },
    }
