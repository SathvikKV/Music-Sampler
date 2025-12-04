import numpy as np
from typing import List
from .features import feature_vector

async def rerank_bandit(user_id: str, session_id: str, candidates: List, k: int = 10):
    scored = []
    seen_artists = set()
    for tr in candidates:
        x = feature_vector(tr)
        theta = np.array(tr.theta_user, dtype=float)
        base = float(theta @ x)
        explore = np.random.normal(0, 0.05)
        div_penalty = 0.15 if tr.artist in seen_artists else 0.0
        score = base + explore - div_penalty
        scored.append((score, tr))
        seen_artists.add(tr.artist)
    scored.sort(key=lambda t: t[0], reverse=True)
    return [t for _, t in scored[:k]]
