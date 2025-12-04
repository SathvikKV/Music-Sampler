import redis.asyncio as redis
from app.settings import settings

r: redis.Redis | None = None

async def init_redis():
    global r
    r = redis.from_url(settings.REDIS_URL, decode_responses=True)

def get_redis() -> redis.Redis:
    assert r is not None, "Redis not initialized"
    return r
