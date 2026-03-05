# database.py - PostgreSQL Database Configuration
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

def _build_url_from_parts() -> str | None:
    host = os.environ.get("PGHOST")
    port = os.environ.get("PGPORT", "5432")
    user = os.environ.get("PGUSER")
    password = os.environ.get("PGPASSWORD")
    database = os.environ.get("PGDATABASE")

    if not all([host, user, password, database]):
        return None

    return f"postgresql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{database}"


def _resolve_database_url() -> str:
    candidates = [
        os.environ.get("DATABASE_URL"),
        os.environ.get("DATABASE_PRIVATE_URL"),
        os.environ.get("DATABASE_PUBLIC_URL"),
        os.environ.get("POSTGRES_URL"),
        os.environ.get("POSTGRES_PRIVATE_URL"),
        os.environ.get("POSTGRES_PUBLIC_URL"),
        os.environ.get("POSTGRESQL_URL"),
        os.environ.get("PG_URL"),
        os.environ.get("RAILWAY_DATABASE_URL"),
    ]

    for candidate in candidates:
        if candidate and candidate.strip():
            return candidate.strip()

    parts_url = _build_url_from_parts()
    if parts_url:
        return parts_url

    is_production = os.environ.get("ENVIRONMENT", "development") == "production" or bool(os.environ.get("RAILWAY_ENVIRONMENT"))
    if is_production:
        raise RuntimeError(
            "Database URL is not configured. Set DATABASE_URL (or POSTGRES_URL), "
            "or provide PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE in Railway."
        )

    return "postgresql://postgres:postgres@localhost:5432/esignify"


# Get database URL from environment
DATABASE_URL = _resolve_database_url()

# Convert to async URL if needed
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# Create async engine
engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Sync engine for migrations
sync_engine = create_engine(DATABASE_URL.replace("+asyncpg", ""))

# Dependency for FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
