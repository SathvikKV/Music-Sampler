from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import settings
from app.services.db import init_engine
from app.services.cache import init_redis

# import routers once
from app.api import (
    health,
    auth,
    feed,
    feedback,
    explain,
    playback,
    playlists,
    sessions as sessions_api,
)

# NEW IMPORTS — AI-powered endpoints
from app.api import assistant, nl  # new endpoints for AI music planner + query normalizer

app = FastAPI(title="Sampler API", version="0.1.0")

# -----------------------------
# CORS configuration
# -----------------------------
cors_list = [o.strip() for o in settings.APP_CORS_ORIGINS.split(",") if o.strip()]

if settings.APP_ENV == "dev":
    # In development, open up completely for easier local testing
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # must be False when allow_origins = ["*"]
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# -----------------------------
# Startup events
# -----------------------------
@app.on_event("startup")
async def startup() -> None:
    await init_engine()
    await init_redis()

# -----------------------------
# Router mounting
# -----------------------------
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])  # → /auth/spotify/...
app.include_router(feed.router, tags=["feed"])
app.include_router(feedback.router, tags=["feedback"])
app.include_router(explain.router, tags=["explain"])  # LLM track explanation
app.include_router(playback.router, tags=["playback"])
app.include_router(playlists.router, tags=["playlists"])
app.include_router(sessions_api.router, tags=["sessions"])

# NEW: AI assistant + query normalization endpoints
app.include_router(assistant.router, tags=["assistant"])
app.include_router(nl.router, tags=["nl"])
