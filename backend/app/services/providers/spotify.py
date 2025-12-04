from __future__ import annotations
from typing import Optional, Dict, Any
from app.services.recsys.clip_selector import choose_clip_window

# You likely already have a Track-like object with fields used below.
# We only need to build the preview dict.

async def resolve_preview(track) -> Optional[Dict[str, Any]]:
    """
    Returns a dict or None:
      {
        "provider": "spotify",
        "id": "spotify:track:3e9HZx...",
        "preview": { "type": "spotify_websdk", "start_ms": ..., "duration_ms": ... }
      }
    """
    # Spotify Web Playback SDK requires Premium and device init on the frontend.
    # We assume you’ll call /playback/token on the frontend to init the SDK.
    start_ms, duration_ms = choose_clip_window(track.duration_ms, track.features_json)
    return {
        "provider": "spotify",
        "id": track.provider_track_id,  # keep the spotify:track:... URI
        "preview": {
            "type": "spotify_websdk",
            "start_ms": start_ms,
            "duration_ms": duration_ms,
        },
    }
