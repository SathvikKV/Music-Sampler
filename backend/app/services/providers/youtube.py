from __future__ import annotations
from typing import Optional, Dict, Any
from app.services.recsys.clip_selector import choose_clip_window

async def resolve_preview(track) -> Optional[Dict[str, Any]]:
    if track.provider != "youtube":
        return None
    # For YouTube, the frontend uses <iframe> with start param.
    # There’s no official "end" param that hard-stops; you’ll stop via JS timer.
    start_ms, duration_ms = choose_clip_window(track.duration_ms, track.features_json)
    # provider_track_id should be the YouTube videoId like "dQw4w9WgXcQ"
    return {
        "provider": "youtube",
        "id": track.provider_track_id,
        "preview": {
            "type": "youtube_embed",
            "url": track.provider_track_id,
            "start_ms": start_ms,
            "duration_ms": duration_ms,
        },
    }
