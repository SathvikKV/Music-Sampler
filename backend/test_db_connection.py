import asyncio
from app.services.db import init_engine, get_db
from sqlalchemy import text

async def test_db():
    print("Initializing engine...")
    await init_engine()
    print("Engine initialized.")
    
    print("Getting session...")
    async for session in get_db():
        print("Session obtained.")
        try:
            print("Executing query...")
            # Insert user 1 if not exists
            await session.execute(text("INSERT INTO users (id, email, created_at, updated_at) VALUES ('1', 'test@example.com', NOW(), NOW()) ON CONFLICT (id) DO NOTHING"))
            await session.commit()
            
            res = await session.execute(text("SELECT * FROM users WHERE id = '1'"))
            user = res.fetchone()
            print(f"User 1: {user}")
        except Exception as e:
            print(f"ERROR: {e}")
        finally:
            await session.close()
        break

if __name__ == "__main__":
    asyncio.run(test_db())
