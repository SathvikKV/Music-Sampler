# v1 heuristics + optional use of any analysis we may have in features_json
from __future__ import annotations
from typing import Optional, Tuple, Dict, Any
import random

DEFAULT_MS = 20000  # 20s sampler

def _safe_int(v, fallback):
    try:
        return int(v)
    except Exception:
        return fallback

def choose_clip_window(track_duration_ms: Optional[int],
                       features_json: Optional[Dict[str, Any]] = None,
                       desired_ms: int = DEFAULT_MS) -> Tuple[int, int]:
    """
    Returns (start_ms, duration_ms) for a short sampler window.
    Heuristics:
      - If we have analysis with 'sections'/'segments', pick the highest energy section (middle of it).
      - Else fallback:
         * if duration > 2:30, start at ~45–75s
         * if 1:30–2:30, start at ~30–45s
         * else start at 0–10s
    """
    d = _safe_int(track_duration_ms, 0)
    # Try to use analysis if present
    if features_json:
        # Example expected shapes (store these when ingesting later):
        # features_json["analysis"]["sections"] = [{"start": sec, "duration": dur, "loudness": x, "confidence": y, "energy": z}, ...]
        analysis = features_json.get("analysis") if isinstance(features_json, dict) else None
        sections = (analysis or {}).get("sections") if isinstance(analysis, dict) else None
        if sections and isinstance(sections, list):
            # pick highest (energy or loudness) section with decent confidence and at least desired_ms
            scored = []
            for s in sections:
                start_s = float(s.get("start", 0.0))
                dur_s   = float(s.get("duration", 0.0))
                energy  = float(s.get("energy", s.get("loudness", -20.0)))
                conf    = float(s.get("confidence", 0.0))
                if dur_s * 1000 >= desired_ms and conf >= 0.3:
                    scored.append((energy, start_s, dur_s))
            if scored:
                scored.sort(reverse=True, key=lambda x: x[0])
                _, start_s, dur_s = scored[0]
                start_ms = int(start_s * 1000)
                # center our window in the section if possible
                center_ms = start_ms + int((dur_s * 1000 - desired_ms) / 2)
                return max(center_ms, 0), desired_ms

    # Fallback heuristic
    if d >= 150000:        # > 2:30
        start_ms = random.randint(45000, min(75000, max(0, d - desired_ms)))
    elif d >= 90000:       # 1:30–2:30
        start_ms = random.randint(30000, min(45000, max(0, d - desired_ms)))
    elif d > 0:
        start_ms = random.randint(0, max(0, min(10000, d - desired_ms)))
    else:
        start_ms = 30000  # unknown, safe default
    return start_ms, desired_ms
