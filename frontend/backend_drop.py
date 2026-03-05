# backend/drop_tables.py
import asyncio
from database import engine, Base    # import any model so metadata is populated

async def drop_all():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("✅ All tables dropped")

if __name__ == "__main__":
    asyncio.run(drop_all())