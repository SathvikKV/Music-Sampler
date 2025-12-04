from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Text
from app.services.db import Base
from app.models.base import Base, TimestampMixin, gen_uuid


class Track(Base, TimestampMixin):
    __tablename__ = "tracks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    provider: Mapped[str] = mapped_column(String)  # spotify|youtube|audius
    provider_track_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String)
    artist: Mapped[str] = mapped_column(String, index=True)
    album: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(nullable=True)
    artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    features_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # json string
