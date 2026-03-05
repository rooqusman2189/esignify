# create_admin.py - Script to create super admin user
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import update
from passlib.context import CryptContext
from dotenv import load_dotenv
from models import User, Tenant, Base

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_super_admin(email: str, password: str, name: str, tenant_id: str):
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/esignify")
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(ASYNC_DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # Create tables if not exist
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Create tenant
        tenant = Tenant(
            id=tenant_id,
            name=name + "'s Organization",
            created_by="system"
        )
        session.add(tenant)
        
        # Create user
        user = User(
            id=f"user_{tenant_id}",
            email=email,
            password_hash=pwd_context.hash(password),
            name=name,
            role="super_admin",
            tenant_id=tenant_id
        )
        session.add(user)
        
        try:
            await session.commit()
            print(f"✅ Super admin created successfully!")
            print(f"   Email: {email}")
            print(f"   Tenant ID: {tenant_id}")
        except Exception as e:
            await session.rollback()
            print(f"❌ Error: {e}")
            # Try updating existing user
            await session.execute(
                update(User).where(User.email == email).values(
                    password_hash=pwd_context.hash(password),
                    role="super_admin",
                    tenant_id=tenant_id
                )
            )
            await session.commit()
            print(f"✅ Existing user updated to super admin!")
    
    await engine.dispose()

if __name__ == "__main__":
    # Default values - change these!
    EMAIL = os.environ.get("ADMIN_EMAIL", "admin@esignify.com")
    PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    NAME = os.environ.get("ADMIN_NAME", "Super Admin")
    TENANT_ID = os.environ.get("ADMIN_TENANT_ID", "default")
    
    print("Creating super admin...")
    asyncio.run(create_super_admin(EMAIL, PASSWORD, NAME, TENANT_ID))
