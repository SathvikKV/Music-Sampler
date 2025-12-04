# app/services/nl_seed.py
from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

# we'll try to import openai client, but code should still work without it
try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None  # type: ignore


# ------------------------------------------------------------
# 1. lightweight heuristic (your old behavior)
# ------------------------------------------------------------
GENRE_KEYWORDS = {
    "lofi": ["lo-fi", "lofi", "chillhop"],
    "hip hop": ["hip hop", "rap", "trap"],
    "edm": ["edm", "dance", "electronic"],
    "house": ["house", "deep house", "tech house"],
    "r&b": ["r&b", "rnb"],
    "rock": ["rock", "alt rock", "indie rock"],
    "indie": ["indie", "bedroom pop"],
    "jazz": ["jazz", "fusion", "smooth jazz"],
    "piano": ["piano", "instrumental"],
    "study": ["study", "focus", "concentration"],
}

VIBE_PATTERNS = [
    # text, genres, energy, mood
    (r"\bgym\b|\bworkout\b|\bfitness\b", ["edm", "house"], 0.85, "workout"),
    (r"\bstudy\b|\bfocus\b|\bconcentrat", ["lofi"], 0.35, "study"),
    (r"\bchill\b|\brelax\b|\bcalm\b", ["lofi", "indie"], 0.3, "chill"),
    (r"\bparty\b|\bclub\b", ["edm", "house"], 0.9, "party"),
    (r"\bjazz\b|\bfusion\b", ["jazz"], 0.5, "jazz"),
]

BPM_RE = re.compile(r"(\d{2,3})\s*bpm", re.IGNORECASE)


def _heuristic_seed(text: str) -> Dict[str, Any]:
    text_l = text.lower()
    seed: Dict[str, Any] = {
        "query": text.strip(),
    }

    # match vibe patterns first
    for pattern, genres, energy, mood in VIBE_PATTERNS:
        if re.search(pattern, text_l):
            seed["genres"] = genres
            seed["energy"] = energy
            seed["mood"] = mood
            break

    # genre keywords
    genres: List[str] = []
    for g, words in GENRE_KEYWORDS.items():
        if any(w in text_l for w in words):
            genres.append(g)
    if genres:
        seed.setdefault("genres", genres)

    # BPM
    m = BPM_RE.search(text_l)
    if m:
      try:
        seed["bpm"] = int(m.group(1))
      except Exception:
        pass

    return seed


# ------------------------------------------------------------
# 2. LLM-powered parsing
# ------------------------------------------------------------
LLM_SYSTEM_PROMPT = (
    "You convert natural-language music requests into a structured JSON seed for a music recommender.\n"
    "Output ONLY JSON. Keys you may use:\n"
    "- query: short text to search or describe the vibe\n"
    "- genres: list of music genres or styles (e.g. [\"lofi\", \"edm\", \"house\", \"jazz\"])\n"
    "- energy: number 0.0 - 1.0 (0 = chill, 1 = very energetic)\n"
    "- mood: short tag like \"study\", \"workout\", \"happy\", \"night\", \"sad\"\n"
    "- bpm: integer BPM if the user implies tempo\n"
    "If user says things like 'gym house music', set energy high and include ['house'].\n"
    "If user says 'something to cheer me up', set mood to 'happy' and energy around 0.6.\n"
)

async def _llm_seed(text: str) -> Optional[Dict[str, Any]]:
    """
    Ask OpenAI (if available) to give us a structured seed.
    Returns None if no key / client not installed / request fails.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    if AsyncOpenAI is None:
        return None

    client = AsyncOpenAI(api_key=api_key)

    try:
        # use a small / cheap model name you actually have
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": LLM_SYSTEM_PROMPT},
                {"role": "user", "content": f"User text: {text}\nReturn JSON now."},
            ],
            # we want pure JSON
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        # new SDK: parsed JSON is at .choices[0].message.parsed if response_format used
        msg = resp.choices[0].message
        if hasattr(msg, "parsed") and isinstance(msg.parsed, dict):
            return msg.parsed  # type: ignore
        # fallback: try to json.loads the string content
        import json
        return json.loads(msg.content or "{}")
    except Exception:
        return None


# ------------------------------------------------------------
# 3. public API
# ------------------------------------------------------------
async def parse_seed(text: str) -> Dict[str, Any]:
    """
    Main entry called by /sessions.
    1) build heuristic seed
    2) try LLM (if env + package is present)
    3) merge, LLM wins
    """
    base = _heuristic_seed(text or "")

    llm = await _llm_seed(text or "")
    if not llm:
        return base

    # merge: preferring LLM when it gives something
    merged = dict(base)
    for k, v in llm.items():
        if v in (None, "", [], {}):
            continue
        merged[k] = v
    return merged
