from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, BigInteger
from app.services.db import Base
from app.models.base import Base, TimestampMixin, gen_uuid


class FeedEvent(Base, TimestampMixin):
    __tablename__ = "feed_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"))
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"))
    event_type: Mapped[str] = mapped_column(String)  # "like" | "skip" | "impression"
    dwell_ms: Mapped[int | None] = mapped_column(nullable=True)
    position: Mapped[int | None] = mapped_column(nullable=True)
