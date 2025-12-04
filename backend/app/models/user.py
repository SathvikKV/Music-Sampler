from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String
from app.services.db import Base
from app.models.base import Base, TimestampMixin, gen_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    handle: Mapped[str | None] = mapped_column(String, nullable=True)
