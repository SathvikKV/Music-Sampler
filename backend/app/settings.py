# app/settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    APP_ENV: str = "dev"
    APP_PORT: int = 8080

    # Keep as a simple CSV string to avoid JSON parsing issues in containers
    APP_CORS_ORIGINS: str = "http://127.0.0.1:3000,http://localhost:3000"

    PG_HOST: str = "postgres"
    PG_PORT: int = 5432
    PG_DB: str = "sampler"
    PG_USER: str = "sampler"
    PG_PASSWORD: str = "sampler"

    REDIS_URL: str = "redis://redis:6379/0"

    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = "http://127.0.0.1:8080/auth/spotify/callback"

    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    TAVILY_API_KEY: Optional[str] = None

    # Loads env from backend/.env (relative to compose)
    model_config = SettingsConfigDict(env_file=[".env", "../.env"], env_file_encoding="utf-8")

settings = Settings()
