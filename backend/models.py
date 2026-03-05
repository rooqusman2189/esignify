# models.py - SQLAlchemy Models for PostgreSQL
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

# Use timezone-aware datetime for PostgreSQL
dt_utc = DateTime(timezone=True)

Base = declarative_base()

def generate_id(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:12]}"

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(50), primary_key=True, default=lambda: generate_id("user_"))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    picture = Column(String(500), nullable=True)
    role = Column(String(50), default="org_admin")  # super_admin, org_admin, user
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=True)
    created_at = Column(dt_utc, default=lambda: datetime.now(timezone.utc))
    
    tenant = relationship("Tenant", back_populates="users")

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    status = Column(String(50), default="active")
    created_by = Column(String(50), nullable=False)
    created_at = Column(dt_utc, default=lambda: datetime.now(timezone.utc))
    
    users = relationship("User", back_populates="tenant")
    employees = relationship("Employee", back_populates="tenant")
    signatures = relationship("Signature", back_populates="tenant")
    sites = relationship("Site", back_populates="tenant")

class Site(Base):
    __tablename__ = "sites"
    
    id = Column(String(50), primary_key=True, default=lambda: generate_id("site_"))
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    created_at = Column(dt_utc, default=lambda: datetime.now(timezone.utc))
    
    tenant = relationship("Tenant", back_populates="sites")

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(String(50), primary_key=True, default=lambda: generate_id("emp_"))
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    title = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    site_id = Column(String(50), ForeignKey("sites.id"), nullable=True)
    phone = Column(String(50), nullable=True)
    mobile = Column(String(50), nullable=True)
    photo_url = Column(String(500), nullable=True)
    social_links = Column(JSON, nullable=True)
    assigned_signature_id = Column(String(50), ForeignKey("signatures.id"), nullable=True)
    deployment_status = Column(String(50), default="pending")
    deployed_at = Column(dt_utc, nullable=True)
    created_at = Column(dt_utc, default=lambda: datetime.now(timezone.utc))
    
    tenant = relationship("Tenant", back_populates="employees")
    signature = relationship("Signature", back_populates="employees")

class Signature(Base):
    __tablename__ = "signatures"
    
    id = Column(String(50), primary_key=True, default=lambda: generate_id("sig_"))
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    html_template = Column(Text, nullable=False)
    template_fields = Column(JSON, default=list)
    is_default = Column(Boolean, default=False)
    created_by = Column(String(50), nullable=False)
    created_at = Column(dt_utc, default=lambda: datetime.now(timezone.utc))
    
    tenant = relationship("Tenant", back_populates="signatures")
    employees = relationship("Employee", back_populates="signature")

class Deployment(Base):
    __tablename__ = "deployments"
    
    id = Column(String(50), primary_key=True, default=lambda: generate_id("dep_"))
    tenant_id = Column(String(50), ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(String(50), nullable=False)
    signature_id = Column(String(50), nullable=False)
    method = Column(String(50), default="manual")
    status = Column(String(50), default="success")
    message_id = Column(String(255), nullable=True)
    deployed_by = Column(String(50), nullable=True)
    deployed_at = Column(dt_utc, default=lambda: datetime.now(timezone.utc))

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(String(50), primary_key=True, default=lambda: generate_id("sess_"))
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(dt_utc, nullable=False)
    created_at = Column(dt_utc, default=lambda: datetime.now(timezone.utc))
