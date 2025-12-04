from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.models.track import Track

class Cand:
    # thin wrapper used by bandit
    def __init__(self, row: Track):
        self.id = row.id
        self.provider = row.provider
        self.provider_track_id = row.provider_track_id
        self.title = row.title
        self.artist = row.artist
        self.artwork_url = row.artwork_url
        self.features_json = row.features_json
        self.tags = []
        self.theta_user = [0.1, 0.2, 0.1, 0.2, -0.1, 0.1]  # placeholder

async def get_candidates(db: AsyncSession, user_id: str, session_id: str, limit: int = 50) -> List[Cand]:
    # v1: naive – recent tracks or popular set; later: FAISS similarity
    rows = (await db.execute(select(Track).limit(limit))).scalars().all()
    return [Cand(r) for r in rows]
