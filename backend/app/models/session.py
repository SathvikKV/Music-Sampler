from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, Text
from app.services.db import Base
from app.models.base import Base, TimestampMixin, gen_uuid


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    seed_json: Mapped[str | None] = mapped_column(Text, nullable=True)
