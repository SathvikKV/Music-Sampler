# app/models/oauth.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, Text, BigInteger
from app.services.db import Base
from app.models.base import Base, TimestampMixin, gen_uuid


class OAuthToken(Base, TimestampMixin):
    __tablename__ = "oauth_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String)  # "spotify"
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    # annotate with Python type; set SQLA type in mapped_column
    expires_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # epoch seconds
    scope: Mapped[str | None] = mapped_column(String, nullable=True)
