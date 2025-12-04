# app/models/playlist.py
from __future__ import annotations

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Integer
from app.models.base import Base, TimestampMixin, gen_uuid


class Playlist(Base, TimestampMixin):
    __tablename__ = "playlists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)

    # your DB requires this and it's NOT NULL
    kind: Mapped[str] = mapped_column(String, nullable=False, default="vibe")

    # no description column here because the DB doesn't have it
    # description: Mapped[str | None] = mapped_column(String, nullable=True)

    tracks: Mapped[list["PlaylistTrack"]] = relationship(
        "PlaylistTrack",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )


class PlaylistTrack(Base, TimestampMixin):
    __tablename__ = "playlist_tracks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    playlist_id: Mapped[str] = mapped_column(ForeignKey("playlists.id"), nullable=False)

    track_id: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_track_id: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    artist: Mapped[str | None] = mapped_column(String, nullable=True)
    artwork_url: Mapped[str | None] = mapped_column(String, nullable=True)

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="tracks")
