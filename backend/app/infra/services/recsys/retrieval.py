from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.models.track import Track

class Cand:
    def __init__(self, row: Track):
        self.id = row.id
        self.provider = row.provider
        self.provider_track_id = row.provider_track_id
        self.title = row.title
        self.artist = row.artist
        self.artwork_url = row.artwork_url
        self.features_json = row.features_json
        self.tags = []
        # placeholder user preference vector
        self.theta_user = [0.1, 0.2, 0.1, 0.2, -0.1, 0.1]

async def get_candidates(db: AsyncSession, user_id: str, session_id: str, limit: int = 50) -> List[Cand]:
    rows = (await db.execute(select(Track).limit(limit))).scalars().all()
    return [Cand(r) for r in rows]
