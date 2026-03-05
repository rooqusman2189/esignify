# ESignify - Email Signature Management Platform

A multi-tenant email signature platform with server-side deployment for Microsoft 365/Exchange Online.

## Tech Stack

- **Backend**: FastAPI, Python 3.11, PostgreSQL, SQLAlchemy
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Database**: PostgreSQL

---

## Part 1: Local Development Setup (VS Code)

### Prerequisites

1. **Python 3.11+** - [Download](https://www.python.org/downloads/)
2. **Node.js 18+** - [Download](https://nodejs.org/)
3. **PostgreSQL 15+** - [Download](https://www.postgresql.org/download/)
4. **VS Code** - [Download](https://code.visualstudio.com/)

### Step 1: Clone/Setup Project

```bash
# Create project folder
mkdir esignify
cd esignify

# Copy backend and frontend folders here
```

### Step 2: Setup PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE esignify;

# Exit
\q
```

### Step 3: Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your PostgreSQL credentials
# DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/esignify
```

### Step 4: Create Super Admin

```bash
# Edit the values in .env first, then run:
cd backend
python scripts/create_admin.py
```

### Step 5: Run Backend

```bash
cd backend
uvicorn server:app --reload --port 8000
```

Backend will be available at: http://localhost:8000

### Step 6: Setup Frontend

```bash
cd frontend

# Install dependencies
npm install
# or
yarn install

# Copy environment file
cp .env.example .env

# Edit .env
# REACT_APP_BACKEND_URL=http://localhost:8000
```

### Step 7: Run Frontend

```bash
cd frontend
npm start
# or
yarn start
```

Frontend will be available at: http://localhost:3000

---

## Part 2: Production Deployment

### Option A: Railway (Backend) + Vercel (Frontend)

#### Backend on Railway:
1. Push `backend` folder to GitHub
2. Create new project on [railway.app](https://railway.app)
3. Add PostgreSQL database
4. Deploy from GitHub
5. Set environment variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```

#### Frontend on Vercel:
1. Push `frontend` folder to GitHub
2. Import to [vercel.com](https://vercel.com)
3. Set environment variable:
   ```
   REACT_APP_BACKEND_URL=https://your-backend.up.railway.app
   ```

### Option B: VPS/Docker

See `docker-compose.yml` for containerized deployment.

---

## Part 3: Microsoft 365 Server-Side Deployment

### Overview

Server-side deployment automatically adds email signatures to ALL outgoing emails without user action. This is done through Exchange Online transport rules.

### Prerequisites

- Microsoft 365 Business or Enterprise subscription
- Exchange Online Administrator role
- PowerShell 5.1 or higher
- Your ESignify backend URL (from Railway/your server)

### Step 1: Install Exchange Online PowerShell Module

Open PowerShell as Administrator:

```powershell
# Install the module
Install-Module -Name ExchangeOnlineManagement -Force -Scope CurrentUser

# Verify installation
Get-Module -ListAvailable -Name ExchangeOnlineManagement
```

### Step 2: Connect to Exchange Online

```powershell
# Connect (you'll be prompted to login)
Connect-ExchangeOnline -UserPrincipalName admin@yourdomain.com
```

### Step 3: Create Outbound Connector

This connector routes emails to your ESignify server:

```powershell
# Replace YOUR_ESIGNIFY_URL with your actual backend URL
$OutboundConnectorParams = @{
    Name = "ESignify Signature Service - Outbound"
    ConnectorType = "Partner"
    SmartHosts = @("your-esignify-backend.up.railway.app")
    TlsSettings = "DomainValidation"
    TlsDomain = "your-esignify-backend.up.railway.app"
    UseMxRecord = $false
    IsTransportRuleScoped = $true
    Comment = "Routes outgoing emails to ESignify for signature injection"
}

New-OutboundConnector @OutboundConnectorParams
```

### Step 4: Create Inbound Connector

This connector accepts processed emails back:

```powershell
$InboundConnectorParams = @{
    Name = "ESignify Signature Service - Inbound"
    ConnectorType = "Partner"
    SenderDomains = @("your-esignify-backend.up.railway.app")
    RequireTls = $true
    RestrictDomainsToCertificate = $false
    Comment = "Accepts emails returning from ESignify with signatures applied"
}

New-InboundConnector @InboundConnectorParams
```

### Step 5: Create Transport Rule

This rule identifies outgoing emails and routes them through ESignify:

```powershell
# Replace YOUR_TENANT_ID with your ESignify tenant ID
$TransportRuleParams = @{
    Name = "ESignify - Route to Signature Service"
    Priority = 0
    FromScope = "InOrganization"
    SentToScope = "NotInOrganization"
    RouteMessageOutboundConnector = "ESignify Signature Service - Outbound"
    SetHeaderName = "X-ESignify-TenantId"
    SetHeaderValue = "YOUR_TENANT_ID"
    Comments = "Routes outgoing external emails through ESignify for signature injection"
}

New-TransportRule @TransportRuleParams
```

### Step 6: Verify Configuration

```powershell
# Check connectors
Get-OutboundConnector | Where-Object {$_.Name -like "ESignify*"}
Get-InboundConnector | Where-Object {$_.Name -like "ESignify*"}

# Check transport rule
Get-TransportRule | Where-Object {$_.Name -like "ESignify*"}
```

### Step 7: Test

1. Wait 15-30 minutes for changes to propagate
2. Send a test email from your organization to an external email
3. Check if the signature is automatically added

### Troubleshooting

**Connector not created:**
```powershell
# Check for errors
Get-OutboundConnector -Identity "ESignify*" | Format-List *
```

**Emails not routing:**
- Verify transport rule is enabled
- Check ESignify backend is accessible
- Review message trace in Exchange Admin Center

**Remove ESignify configuration:**
```powershell
Remove-TransportRule -Identity "ESignify - Route to Signature Service" -Confirm:$false
Remove-OutboundConnector -Identity "ESignify Signature Service - Outbound" -Confirm:$false
Remove-InboundConnector -Identity "ESignify Signature Service - Inbound" -Confirm:$false
```

---

## Part 4: M365 Admin Center Manual Steps

If you prefer using the Admin Center UI instead of PowerShell:

### Step 1: Access Exchange Admin Center

1. Go to [admin.microsoft.com](https://admin.microsoft.com)
2. Click **Admin centers** → **Exchange**
3. Or go directly to [admin.exchange.microsoft.com](https://admin.exchange.microsoft.com)

### Step 2: Create Outbound Connector

1. Go to **Mail flow** → **Connectors**
2. Click **+ Add a connector**
3. Select:
   - Connection from: **Office 365**
   - Connection to: **Partner organization**
4. Name: `ESignify Signature Service - Outbound`
5. When to use: **Only when I have a transport rule...**
6. Routing: **Route email through these smart hosts**
   - Add: `your-esignify-backend.up.railway.app`
7. Security: **Always use TLS**
8. Save

### Step 3: Create Inbound Connector

1. Go to **Mail flow** → **Connectors**
2. Click **+ Add a connector**
3. Select:
   - Connection from: **Partner organization**
   - Connection to: **Office 365**
4. Name: `ESignify Signature Service - Inbound`
5. Authenticating: **By verifying sender domain**
   - Add: `your-esignify-backend.up.railway.app`
6. Save

### Step 4: Create Transport Rule

1. Go to **Mail flow** → **Rules**
2. Click **+ Add a rule** → **Create a new rule**
3. Name: `ESignify - Route to Signature Service`
4. Apply this rule if:
   - **The sender is located...** → **Inside the organization**
5. Do the following:
   - **Redirect the message to...** → Select the outbound connector
   - **Set the message header** → `X-ESignify-TenantId` = `your-tenant-id`
6. Except if:
   - **The recipient is located...** → **Inside the organization**
7. Priority: 0 (highest)
8. Save

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Employees
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee
- `PATCH /api/employees/{id}` - Update employee
- `DELETE /api/employees/{id}` - Delete employee
- `POST /api/employees/assign-signature` - Assign signature to employees

### Signatures
- `GET /api/signatures` - List all signatures
- `POST /api/signatures` - Create signature
- `PATCH /api/signatures/{id}` - Update signature
- `DELETE /api/signatures/{id}` - Delete signature

### Server-Side Processing
- `POST /api/signatures/process` - Process email and inject signature
- `GET /api/signatures/process/test` - Test signature lookup

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard statistics

---

## Support

For issues or questions, create an issue on GitHub.

## License

MIT License
"# Esignify" 
