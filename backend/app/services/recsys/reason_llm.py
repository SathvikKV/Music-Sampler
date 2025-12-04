import os
import json
from app.settings import settings

REASON_PROMPT = (
    "You are a concise music curator.\n"
    "User taste: {taste}\n"
    "Track: \"{title}\" by {artist}\n"
    "Audio traits: energy={energy}, tempo={tempo}bpm, mood={mood}, similar_to={similar_to}\n"
    "In 1–2 sentences, explain why this track fits, casual tone, no more than 24 words."
)

async def explain_track(user_id: str, track_id: str, context: dict) -> str:
    # v1 stub – replace with OpenAI call; cache by (user,track)
    title = context.get("title", "Unknown")
    artist = context.get("artist", "Unknown")
    return f"{title} matches your upbeat taste and synth vibe—similar energy to songs you liked, great for a night drive."
