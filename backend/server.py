# server.py - FastAPI Backend with PostgreSQL
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import csv
import io

from database import get_db, engine
from models import Base, User, Tenant, Site, Employee, Signature, Deployment, UserSession, generate_id

# Create tables
import asyncio

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(title="ESignify API", version="1.0.0")
api_router = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class BootstrapAdminRequest(BaseModel):
    bootstrap_token: str

class TenantCreate(BaseModel):
    name: str
    tenant_id: str

class SiteCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

class EmployeeCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    title: Optional[str] = None
    department: Optional[str] = None
    site_id: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    photo_url: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None

class SignatureCreate(BaseModel):
    name: str
    html_template: str
    template_fields: List[str] = []
    is_default: bool = False

class EmailProcessRequest(BaseModel):
    sender_email: str
    recipient_email: Optional[str] = None
    subject: Optional[str] = None
    body_html: str
    body_text: Optional[str] = None
    tenant_id: str
    message_id: Optional[str] = None

# Organization Management Schemas
class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    status: Optional[str] = None

class MemberInvite(BaseModel):
    email: EmailStr
    role: str = "org_admin"  # super_admin, org_admin, user

class MemberUpdate(BaseModel):
    role: str

class OrganizationResponse(BaseModel):
    id: str
    name: str
    domain: Optional[str]
    status: str
    created_at: datetime
    members_count: int = 0

class MemberResponse(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    created_at: datetime

# Auth helpers
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.execute(
        select(UserSession).where(
            UserSession.session_token == session_token,
            UserSession.expires_at > datetime.now(timezone.utc)
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")
    
    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin required")
    return user

# Auth Routes
@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not pwd_context.verify(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = f"session_{uuid.uuid4().hex}"
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()
    
    # Set secure flag based on environment
    is_production = os.environ.get("ENVIRONMENT", "development") == "production"
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=7*24*60*60,
        path="/"
    )
    
    return {
        "success": True,
        "data": {
            "user": {
                "user_id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "tenant_id": user.tenant_id
            }
        }
    }

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "user_id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "tenant_id": user.tenant_id
        }
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.execute(delete(UserSession).where(UserSession.session_token == session_token))
        await db.commit()
    response.delete_cookie("session_token", path="/")
    return {"success": True, "message": "Logged out"}

@api_router.post("/auth/bootstrap-admin")
async def bootstrap_admin(payload: BootstrapAdminRequest, db: AsyncSession = Depends(get_db)):
    expected_token = os.environ.get("BOOTSTRAP_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=403, detail="Bootstrap is disabled")

    if payload.bootstrap_token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid bootstrap token")

    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    admin_name = os.environ.get("ADMIN_NAME", "Super Admin")
    admin_tenant_id = os.environ.get("ADMIN_TENANT_ID", "default")

    if not admin_email or not admin_password:
        raise HTTPException(status_code=400, detail="ADMIN_EMAIL and ADMIN_PASSWORD are required")

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == admin_tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        tenant = Tenant(
            id=admin_tenant_id,
            name=f"{admin_name}'s Organization",
            created_by="system"
        )
        db.add(tenant)

    user_result = await db.execute(select(User).where(User.email == admin_email))
    user = user_result.scalar_one_or_none()

    if user:
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                password_hash=pwd_context.hash(admin_password),
                name=admin_name,
                role="super_admin",
                tenant_id=admin_tenant_id
            )
        )
        action = "updated"
    else:
        user = User(
            id=generate_id("user"),
            email=admin_email,
            password_hash=pwd_context.hash(admin_password),
            name=admin_name,
            role="super_admin",
            tenant_id=admin_tenant_id
        )
        db.add(user)
        action = "created"

    await db.commit()

    return {
        "success": True,
        "message": f"Super admin {action} successfully",
        "data": {
            "email": admin_email,
            "tenant_id": admin_tenant_id,
            "action": action
        }
    }

# Tenant Routes
@api_router.get("/tenants/me")
async def get_my_tenant(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        return {"success": False, "message": "No tenant assigned"}
    
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        return {"success": False, "message": "Tenant not found"}
    
    return {
        "success": True,
        "data": {
            "tenant_id": tenant.id,
            "name": tenant.name,
            "domain": tenant.domain,
            "status": tenant.status
        }
    }

@api_router.post("/tenants")
async def create_tenant(data: TenantCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant = Tenant(
        id=data.tenant_id,
        name=data.name,
        created_by=user.id
    )
    db.add(tenant)
    
    # Only set tenant_id if user doesn't have one yet (first organization)
    if not user.tenant_id:
        await db.execute(update(User).where(User.id == user.id).values(tenant_id=data.tenant_id))
    
    await db.commit()
    
    return {"success": True, "data": {"tenant_id": tenant.id, "name": tenant.name}}

# Organization Management Routes (Multi-Tenant)
@api_router.get("/organizations")
async def list_organizations(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all organizations for current user"""
    # For super_admin, show all organizations they created
    # For regular users, show organizations where they're a member
    if user.role == "super_admin":
        result = await db.execute(select(Tenant).where(Tenant.created_by == user.id))
    elif user.tenant_id:
        result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    else:
        result = await db.execute(select(Tenant))
    
    tenants = result.scalars().all()
    
    org_list = []
    for tenant in tenants:
        member_result = await db.execute(
            select(func.count(User.id)).where(User.tenant_id == tenant.id)
        )
        members_count = member_result.scalar() or 0
        
        org_list.append({
            "id": tenant.id,
            "name": tenant.name,
            "domain": tenant.domain,
            "status": tenant.status,
            "created_at": tenant.created_at,
            "members_count": members_count
        })
    
    return {"success": True, "data": org_list}

@api_router.get("/organizations/{org_id}")
async def get_organization(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get organization details - must be super_admin or member"""
    result = await db.execute(select(Tenant).where(Tenant.id == org_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Super admin can view any org, regular users only their member orgs
    if user.role != "super_admin" and (not user.tenant_id or user.tenant_id != org_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this organization")
    
    member_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == org_id)
    )
    members_count = member_result.scalar() or 0
    
    return {
        "success": True,
        "data": {
            "id": tenant.id,
            "name": tenant.name,
            "domain": tenant.domain,
            "status": tenant.status,
            "created_at": tenant.created_at,
            "members_count": members_count
        }
    }

@api_router.put("/organizations/{org_id}")
async def update_organization(org_id: str, data: OrganizationUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update organization - admin only"""
    if not user.tenant_id or user.tenant_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if user.role not in ["super_admin", "org_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update organization")
    
    result = await db.execute(select(Tenant).where(Tenant.id == org_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if data.name:
        tenant.name = data.name
    if data.domain:
        tenant.domain = data.domain
    if data.status:
        tenant.status = data.status
    
    await db.commit()
    
    return {"success": True, "data": {"id": tenant.id, "name": tenant.name}}

@api_router.delete("/organizations/{org_id}")
async def delete_organization(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete organization - super admin only"""
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can delete organizations")
    
    result = await db.execute(select(Tenant).where(Tenant.id == org_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    await db.delete(tenant)
    await db.commit()
    
    return {"success": True, "message": "Organization deleted"}

@api_router.get("/organizations/{org_id}/members")
async def list_organization_members(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all members of an organization"""
    if not user.tenant_id or user.tenant_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized to view members")
    
    result = await db.execute(select(User).where(User.tenant_id == org_id))
    members = result.scalars().all()
    
    members_data = []
    for member in members:
        members_data.append({
            "user_id": member.id,
            "email": member.email,
            "name": member.name,
            "role": member.role,
            "created_at": member.created_at
        })
    
    return {"success": True, "data": members_data}

@api_router.post("/organizations/{org_id}/members")
async def invite_member(org_id: str, data: MemberInvite, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Invite a new member to organization - admin only"""
    if not user.tenant_id or user.tenant_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if user.role not in ["super_admin", "org_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can invite members")
    
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == data.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        if existing_user.tenant_id == org_id:
            raise HTTPException(status_code=400, detail="User already a member of this organization")
        # Update existing user to join org
        existing_user.tenant_id = org_id
        existing_user.role = data.role
        await db.commit()
        return {"success": True, "message": "User added to organization"}
    
    # Create new user
    new_user = User(
        email=data.email,
        name=data.email.split("@")[0],  # Use email prefix as name
        tenant_id=org_id,
        role=data.role,
        password_hash=None  # Will be set when user sets password
    )
    db.add(new_user)
    await db.commit()
    
    return {"success": True, "data": {"user_id": new_user.id, "email": new_user.email}}

@api_router.put("/organizations/{org_id}/members/{member_id}")
async def update_member_role(org_id: str, member_id: str, data: MemberUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update member role - admin only"""
    if not user.tenant_id or user.tenant_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if user.role not in ["super_admin", "org_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update member roles")
    
    result = await db.execute(select(User).where(User.id == member_id, User.tenant_id == org_id))
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.role = data.role
    await db.commit()
    
    return {"success": True, "data": {"user_id": member.id, "role": member.role}}

@api_router.delete("/organizations/{org_id}/members/{member_id}")
async def remove_member(org_id: str, member_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Remove member from organization - admin only"""
    if not user.tenant_id or user.tenant_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if user.role not in ["super_admin", "org_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can remove members")
    
    if member_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    
    result = await db.execute(select(User).where(User.id == member_id, User.tenant_id == org_id))
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.tenant_id = None
    member.role = "user"
    await db.commit()
    
    return {"success": True, "message": "Member removed from organization"}

# Organization-Scoped Routes (for org workspace context)
@api_router.get("/organizations/{org_id}/employees")
async def list_org_employees(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List employees for a specific organization"""
    # User must be member of this org or super_admin
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this organization")
    
    result = await db.execute(
        select(Employee).where(Employee.tenant_id == org_id)
    )
    employees = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "employee_id": emp.id,
                "email": emp.email,
                "first_name": emp.first_name,
                "last_name": emp.last_name,
                "title": emp.title,
                "department": emp.department,
                "phone": emp.phone,
                "mobile": emp.mobile,
                "assigned_signature_id": emp.assigned_signature_id,
                "site_id": emp.site_id,
                "deployment_status": emp.deployment_status
            }
            for emp in employees
        ]
    }

@api_router.post("/organizations/{org_id}/employees")
async def create_org_employee(org_id: str, data: EmployeeCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create employee for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    employee = Employee(
        tenant_id=org_id,
        email=data.email.lower(),
        first_name=data.first_name,
        last_name=data.last_name,
        title=data.title,
        department=data.department,
        site_id=data.site_id,
        phone=data.phone,
        mobile=data.mobile,
        photo_url=data.photo_url,
        social_links=data.social_links
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    return {"success": True, "data": {"employee_id": employee.id}}

@api_router.patch("/organizations/{org_id}/employees/{employee_id}")
async def update_org_employee(org_id: str, employee_id: str, data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update employee for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    result = await db.execute(
        update(Employee)
        .where(Employee.id == employee_id, Employee.tenant_id == org_id)
        .values(**data)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    return {"success": True, "message": "Employee updated"}

@api_router.delete("/organizations/{org_id}/employees/{employee_id}")
async def delete_org_employee(org_id: str, employee_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete employee for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    result = await db.execute(
        delete(Employee).where(Employee.id == employee_id, Employee.tenant_id == org_id)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    return {"success": True, "message": "Employee deleted"}

@api_router.get("/organizations/{org_id}/signatures")
async def list_org_signatures(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List signatures for a specific organization"""
    # User must be member of this org or super_admin
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this organization")
    
    result = await db.execute(
        select(Signature).where(Signature.tenant_id == org_id)
    )
    signatures = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "signature_id": sig.id,
                "name": sig.name,
                "html_template": sig.html_template,
                "template_fields": sig.template_fields,
                "is_default": sig.is_default
            }
            for sig in signatures
        ]
    }

@api_router.post("/organizations/{org_id}/signatures")
async def create_org_signature(org_id: str, data: SignatureCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create signature for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    signature = Signature(
        tenant_id=org_id,
        name=data.name,
        html_template=data.html_template,
        template_fields=data.template_fields,
        is_default=data.is_default,
        created_by=user.id
    )
    db.add(signature)
    await db.commit()
    await db.refresh(signature)

    return {"success": True, "data": {"signature_id": signature.id}}

@api_router.patch("/organizations/{org_id}/signatures/{signature_id}")
async def update_org_signature(org_id: str, signature_id: str, data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update signature for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    result = await db.execute(
        update(Signature)
        .where(Signature.id == signature_id, Signature.tenant_id == org_id)
        .values(**data)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Signature not found")

    return {"success": True, "message": "Signature updated"}

@api_router.delete("/organizations/{org_id}/signatures/{signature_id}")
async def delete_org_signature(org_id: str, signature_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete signature for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    result = await db.execute(
        delete(Signature).where(Signature.id == signature_id, Signature.tenant_id == org_id)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Signature not found")

    return {"success": True, "message": "Signature deleted"}

@api_router.get("/organizations/{org_id}/sites")
async def list_org_sites(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List sites for a specific organization"""
    # User must be member of this org or super_admin
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this organization")
    
    result = await db.execute(
        select(Site).where(Site.tenant_id == org_id)
    )
    sites = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "site_id": site.id,
                "name": site.name,
                "address": site.address,
                "phone": site.phone,
                "city": site.city,
                "country": site.country
            }
            for site in sites
        ]
    }

@api_router.post("/organizations/{org_id}/sites")
async def create_org_site(org_id: str, data: SiteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create site for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    site = Site(
        tenant_id=org_id,
        name=data.name,
        address=data.address,
        phone=data.phone,
        city=data.city,
        country=data.country
    )
    db.add(site)
    await db.commit()
    await db.refresh(site)

    return {"success": True, "data": {"site_id": site.id}}

@api_router.patch("/organizations/{org_id}/sites/{site_id}")
async def update_org_site(org_id: str, site_id: str, data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update site for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    result = await db.execute(
        update(Site)
        .where(Site.id == site_id, Site.tenant_id == org_id)
        .values(**data)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Site not found")

    return {"success": True, "message": "Site updated"}

@api_router.delete("/organizations/{org_id}/sites/{site_id}")
async def delete_org_site(org_id: str, site_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete site for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    result = await db.execute(
        delete(Site).where(Site.id == site_id, Site.tenant_id == org_id)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Site not found")

    return {"success": True, "message": "Site deleted"}

@api_router.post("/organizations/{org_id}/employees/assign-site")
async def assign_org_site(org_id: str, data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Assign a site to an employee in a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this organization")

    employee_id = data.get("employee_id")
    site_id = data.get("site_id")

    if not employee_id or not site_id:
        raise HTTPException(status_code=400, detail="Employee ID and Site ID are required")

    emp_result = await db.execute(
        select(Employee)
        .where(Employee.id == employee_id)
        .where(Employee.tenant_id == org_id)
    )
    employee = emp_result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    site_result = await db.execute(
        select(Site)
        .where(Site.id == site_id)
        .where(Site.tenant_id == org_id)
    )
    site = site_result.scalar_one_or_none()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    await db.execute(
        update(Employee)
        .where(Employee.id == employee_id, Employee.tenant_id == org_id)
        .values(site_id=site_id)
    )
    await db.commit()

    return {"success": True, "message": f"Site assigned to {employee.first_name} {employee.last_name}"}

@api_router.post("/employees/assign-site")
async def assign_site(data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Assign a site to an employee"""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    employee_id = data.get("employee_id")
    site_id = data.get("site_id")
    
    if not employee_id or not site_id:
        raise HTTPException(status_code=400, detail="Employee ID and Site ID are required")
    
    # Verify employee exists and belongs to user's organization
    emp_result = await db.execute(
        select(Employee)
        .where(Employee.id == employee_id)
        .where(Employee.tenant_id == user.tenant_id)
    )
    employee = emp_result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Verify site exists and belongs to user's organization
    site_result = await db.execute(
        select(Site)
        .where(Site.id == site_id)
        .where(Site.tenant_id == user.tenant_id)
    )
    site = site_result.scalar_one_or_none()
    
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Assign site to employee
    await db.execute(
        update(Employee)
        .where(Employee.id == employee_id)
        .values(site_id=site_id)
    )
    await db.commit()
    
    return {"success": True, "message": f"Site assigned to {employee.first_name} {employee.last_name}"}

# Employee Routes
@api_router.get("/employees")
async def list_employees(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        select(Employee).where(Employee.tenant_id == user.tenant_id)
    )
    employees = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "employee_id": emp.id,
                "email": emp.email,
                "first_name": emp.first_name,
                "last_name": emp.last_name,
                "title": emp.title,
                "department": emp.department,
                "phone": emp.phone,
                "mobile": emp.mobile,
                "assigned_signature_id": emp.assigned_signature_id,
                "site_id": emp.site_id,
                "deployment_status": emp.deployment_status
            }
            for emp in employees
        ]
    }

@api_router.post("/employees")
async def create_employee(data: EmployeeCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    employee = Employee(
        tenant_id=user.tenant_id,
        email=data.email.lower(),
        first_name=data.first_name,
        last_name=data.last_name,
        title=data.title,
        department=data.department,
        site_id=data.site_id,
        phone=data.phone,
        mobile=data.mobile,
        photo_url=data.photo_url,
        social_links=data.social_links
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    
    return {"success": True, "data": {"employee_id": employee.id}}

@api_router.patch("/employees/{employee_id}")
async def update_employee(employee_id: str, data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        update(Employee)
        .where(Employee.id == employee_id, Employee.tenant_id == user.tenant_id)
        .values(**data)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"success": True, "message": "Employee updated"}

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        delete(Employee).where(Employee.id == employee_id, Employee.tenant_id == user.tenant_id)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"success": True, "message": "Employee deleted"}

@api_router.post("/employees/assign-signature")
async def assign_signature(data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    employee_ids = data.get("employee_ids", [])
    signature_id = data.get("signature_id")
    
    await db.execute(
        update(Employee)
        .where(Employee.id.in_(employee_ids), Employee.tenant_id == user.tenant_id)
        .values(assigned_signature_id=signature_id)
    )
    await db.commit()
    
    return {"success": True, "message": f"Signature assigned to {len(employee_ids)} employees"}

# Signature Routes
@api_router.get("/signatures")
async def list_signatures(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        select(Signature).where(Signature.tenant_id == user.tenant_id)
    )
    signatures = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "signature_id": sig.id,
                "name": sig.name,
                "html_template": sig.html_template,
                "template_fields": sig.template_fields,
                "is_default": sig.is_default
            }
            for sig in signatures
        ]
    }

@api_router.post("/signatures")
async def create_signature(data: SignatureCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    signature = Signature(
        tenant_id=user.tenant_id,
        name=data.name,
        html_template=data.html_template,
        template_fields=data.template_fields,
        is_default=data.is_default,
        created_by=user.id
    )
    db.add(signature)
    await db.commit()
    await db.refresh(signature)
    
    return {"success": True, "data": {"signature_id": signature.id}}

@api_router.patch("/signatures/{signature_id}")
async def update_signature(signature_id: str, data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        update(Signature)
        .where(Signature.id == signature_id, Signature.tenant_id == user.tenant_id)
        .values(**data)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    return {"success": True, "message": "Signature updated"}

@api_router.delete("/signatures/{signature_id}")
async def delete_signature(signature_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        delete(Signature).where(Signature.id == signature_id, Signature.tenant_id == user.tenant_id)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    return {"success": True, "message": "Signature deleted"}

# Site Routes
@api_router.get("/sites")
async def list_sites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        select(Site).where(Site.tenant_id == user.tenant_id)
    )
    sites = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "site_id": site.id,
                "name": site.name,
                "address": site.address,
                "phone": site.phone,
                "city": site.city,
                "country": site.country
            }
            for site in sites
        ]
    }

@api_router.post("/sites")
async def create_site(data: SiteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    site = Site(
        tenant_id=user.tenant_id,
        name=data.name,
        address=data.address,
        phone=data.phone,
        city=data.city,
        country=data.country
    )
    db.add(site)
    await db.commit()
    await db.refresh(site)
    
    return {"success": True, "data": {"site_id": site.id}}

# Analytics
@api_router.get("/analytics/dashboard")
async def get_analytics(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    total_employees = await db.scalar(
        select(func.count(Employee.id)).where(Employee.tenant_id == user.tenant_id)
    )
    deployed = await db.scalar(
        select(func.count(Employee.id)).where(
            Employee.tenant_id == user.tenant_id,
            Employee.deployment_status == "deployed"
        )
    )
    total_signatures = await db.scalar(
        select(func.count(Signature.id)).where(Signature.tenant_id == user.tenant_id)
    )
    
    deployment_rate = (deployed / total_employees * 100) if total_employees > 0 else 0
    
    return {
        "success": True,
        "data": {
            "total_employees": total_employees or 0,
            "deployed_signatures": deployed or 0,
            "pending_deployments": (total_employees or 0) - (deployed or 0),
            "deployment_rate": round(deployment_rate, 1),
            "active_templates": total_signatures or 0
        }
    }

# Deployment History
@api_router.get("/deployments/history")
async def get_deployment_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    result = await db.execute(
        select(Deployment)
        .where(Deployment.tenant_id == user.tenant_id)
        .order_by(Deployment.deployed_at.desc())
        .limit(100)
    )
    deployments = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "deployment_id": dep.id,
                "employee_id": dep.employee_id,
                "signature_id": dep.signature_id,
                "method": dep.method,
                "status": dep.status,
                "deployed_at": dep.deployed_at.isoformat() if dep.deployed_at else None
            }
            for dep in deployments
        ]
    }

@api_router.get("/organizations/{org_id}/deployments/history")
async def get_org_deployment_history(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get deployment history for a specific organization"""
    if user.role != "super_admin":
        if not user.tenant_id or user.tenant_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this organization")

    result = await db.execute(
        select(Deployment)
        .where(Deployment.tenant_id == org_id)
        .order_by(Deployment.deployed_at.desc())
        .limit(100)
    )
    deployments = result.scalars().all()

    return {
        "success": True,
        "data": [
            {
                "deployment_id": dep.id,
                "employee_id": dep.employee_id,
                "signature_id": dep.signature_id,
                "method": dep.method,
                "status": dep.status,
                "deployed_at": dep.deployed_at.isoformat() if dep.deployed_at else None
            }
            for dep in deployments
        ]
    }

# Bulk Deployment
@api_router.post("/deployments/bulk-deploy")
async def bulk_deploy(data: Dict[str, Any], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    employee_ids = data.get("employee_ids", [])
    method = data.get("method", "manual")
    
    if not employee_ids:
        raise HTTPException(status_code=400, detail="No employees selected")
    
    successful = 0
    failed = 0
    
    # Get all employees with their assigned signatures
    result = await db.execute(
        select(Employee)
        .where(Employee.id.in_(employee_ids))
        .where(Employee.tenant_id == user.tenant_id)
    )
    employees = result.scalars().all()
    
    for emp in employees:
        try:
            # Only deploy if employee has an assigned signature
            if emp.assigned_signature_id:
                # Create deployment record
                deployment = Deployment(
                    tenant_id=user.tenant_id,
                    employee_id=emp.id,
                    signature_id=emp.assigned_signature_id,
                    method=method,
                    status="success",
                    deployed_by=user.id
                )
                db.add(deployment)
                
                # Update employee deployment status
                await db.execute(
                    update(Employee)
                    .where(Employee.id == emp.id)
                    .values(deployment_status="deployed")
                )
                
                successful += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            print(f"Failed to deploy for employee {emp.id}: {str(e)}")
    
    await db.commit()
    
    return {
        "success": True,
        "data": {
            "successful": successful,
            "failed": failed
        }
    }

# Generate Deployment Preview
@api_router.post("/deployments/generate")
async def generate_deployment(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")
    
    # Get employee_id from query parameter
    employee_id = request.query_params.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    
    # Get employee with their assigned signature
    result = await db.execute(
        select(Employee)
        .where(Employee.id == employee_id)
        .where(Employee.tenant_id == user.tenant_id)
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if not employee.assigned_signature_id:
        raise HTTPException(status_code=400, detail="No signature assigned to this employee")
    
    # Get the signature template
    sig_result = await db.execute(
        select(Signature)
        .where(Signature.id == employee.assigned_signature_id)
        .where(Signature.tenant_id == user.tenant_id)
    )
    signature = sig_result.scalar_one_or_none()
    
    if not signature:
        raise HTTPException(status_code=404, detail="Signature template not found")
    
    # Generate personalized signature
    signature_html = signature.html_template
    replacements = {
        "{{first_name}}": employee.first_name or "",
        "{{last_name}}": employee.last_name or "",
        "{{email}}": employee.email or "",
        "{{title}}": employee.title or "",
        "{{department}}": employee.department or "",
        "{{phone}}": employee.phone or "",
        "{{mobile}}": employee.mobile or "",
    }
    
    for placeholder, value in replacements.items():
        signature_html = signature_html.replace(placeholder, value)
    
    return {
        "success": True,
        "data": {
            "html": signature_html,
            "employee": {
                "id": employee.id,
                "email": employee.email,
                "name": f"{employee.first_name} {employee.last_name}"
            }
        }
    }

# Server-Side Signature Processing
@api_router.post("/signatures/process")
async def process_email_signature(request: EmailProcessRequest, db: AsyncSession = Depends(get_db)):
    """Process email and inject personalized signature"""
    try:
        result = await db.execute(
            select(Employee).where(
                Employee.email == request.sender_email.lower(),
                Employee.tenant_id == request.tenant_id
            )
        )
        employee = result.scalar_one_or_none()
        
        if not employee or not employee.assigned_signature_id:
            return {
                "success": True,
                "body_html": request.body_html,
                "body_text": request.body_text,
                "signature_applied": False
            }
        
        result = await db.execute(
            select(Signature).where(Signature.id == employee.assigned_signature_id)
        )
        signature = result.scalar_one_or_none()
        
        if not signature:
            return {
                "success": True,
                "body_html": request.body_html,
                "body_text": request.body_text,
                "signature_applied": False
            }
        
        # Generate personalized signature
        signature_html = signature.html_template
        replacements = {
            "{{first_name}}": employee.first_name or "",
            "{{last_name}}": employee.last_name or "",
            "{{email}}": employee.email or "",
            "{{title}}": employee.title or "",
            "{{department}}": employee.department or "",
            "{{phone}}": employee.phone or "",
            "{{mobile}}": employee.mobile or "",
        }
        
        for placeholder, value in replacements.items():
            signature_html = signature_html.replace(placeholder, value)
        
        # Wrap and append signature
        signature_wrapper = f'''
<div class="esignify-signature" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5;">
{signature_html}
</div>'''
        
        body_html = request.body_html
        if 'esignify-signature' in body_html:
            import re
            body_html = re.sub(
                r'<div class="esignify-signature"[^>]*>[\s\S]*?</div>',
                signature_wrapper,
                body_html
            )
        else:
            if '</body>' in body_html.lower():
                insert_pos = body_html.lower().rfind('</body>')
                body_html = body_html[:insert_pos] + signature_wrapper + body_html[insert_pos:]
            else:
                body_html = body_html + signature_wrapper
        
        # Log deployment
        deployment = Deployment(
            tenant_id=request.tenant_id,
            employee_id=employee.id,
            signature_id=signature.id,
            method="server_side",
            status="success",
            message_id=request.message_id
        )
        db.add(deployment)
        await db.commit()
        
        return {
            "success": True,
            "body_html": body_html,
            "body_text": request.body_text,
            "signature_applied": True,
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "signature_name": signature.name
        }
        
    except Exception as e:
        logging.error(f"Error processing signature: {e}")
        return {
            "success": False,
            "body_html": request.body_html,
            "body_text": request.body_text,
            "signature_applied": False
        }

@api_router.get("/signatures/process/test")
async def test_signature_process(email: str, tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Test if an employee has a signature assigned"""
    result = await db.execute(
        select(Employee).where(
            Employee.email == email.lower(),
            Employee.tenant_id == tenant_id
        )
    )
    employee = result.scalar_one_or_none()
    
    if not employee:
        return {"success": False, "message": "Employee not found"}
    
    if not employee.assigned_signature_id:
        return {"success": False, "message": "No signature assigned"}
    
    result = await db.execute(
        select(Signature).where(Signature.id == employee.assigned_signature_id)
    )
    signature = result.scalar_one_or_none()
    
    if not signature:
        return {"success": False, "message": "Signature not found"}
    
    return {
        "success": True,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "signature_name": signature.name
    }

# Include router
app.include_router(api_router)

# Static files
ROOT_DIR = Path(__file__).parent
static_path = ROOT_DIR / "static"
if static_path.exists():
    app.mount("/api/static", StaticFiles(directory=str(static_path)), name="static")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup():
    await init_db()

logging.basicConfig(level=logging.INFO)
