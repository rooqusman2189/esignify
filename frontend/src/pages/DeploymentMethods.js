import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Download, CheckCircle, Server, Mail, Settings, AlertTriangle, ExternalLink, Shield } from 'lucide-react';
import { toast } from 'sonner';

export const DeploymentMethods = () => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [domainName, setDomainName] = useState('yourdomain.com');
  
  const API_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  
  // Get tenant_id from user context or tenant data
  const tenantId = user?.tenant_id || tenant?.tenant_id || 'YOUR_TENANT_ID';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const tenantRes = await api.get('/api/tenants/me');
      if (tenantRes.data.success) {
        setTenant(tenantRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load tenant');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadFile = (content, filename, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  // Generate the full PowerShell setup script for server-side deployment
  const generateServerSideScript = () => {
    return `# ============================================================
# ESignify Server-Side Email Signature Deployment
# ============================================================
# This script configures Exchange Online to route ALL outgoing
# emails through ESignify for automatic signature injection.
#
# Requirements:
# - Exchange Online Administrator permissions
# - ExchangeOnlineManagement PowerShell module
# ============================================================

# STEP 1: Connect to Exchange Online
# ----------------------------------
# Install-Module -Name ExchangeOnlineManagement -Force -Scope CurrentUser
Connect-ExchangeOnline -UserPrincipalName admin@${domainName}

# STEP 2: Create Outbound Connector to ESignify
# ---------------------------------------------
# This connector routes emails to ESignify's signature processing service

$OutboundConnectorParams = @{
    Name = "ESignify Signature Service - Outbound"
    ConnectorType = "Partner"
    SmartHosts = @("signatures.esignify.io")
    TlsSettings = "CertificateValidation"
    TlsDomain = "signatures.esignify.io"
    UseMxRecord = $false
    IsTransportRuleScoped = $true
    Comment = "Routes outgoing emails to ESignify for signature injection"
}

# Remove existing connector if present
$existing = Get-OutboundConnector -Identity "ESignify Signature Service - Outbound" -ErrorAction SilentlyContinue
if ($existing) {
    Remove-OutboundConnector -Identity "ESignify Signature Service - Outbound" -Confirm:$false
    Write-Host "Removed existing outbound connector" -ForegroundColor Yellow
}

New-OutboundConnector @OutboundConnectorParams
Write-Host "Created outbound connector to ESignify" -ForegroundColor Green

# STEP 3: Create Inbound Connector from ESignify
# ----------------------------------------------
# This connector accepts processed emails back from ESignify

$InboundConnectorParams = @{
    Name = "ESignify Signature Service - Inbound"
    ConnectorType = "Partner"
    SenderDomains = @("signatures.esignify.io")
    RequireTls = $true
    RestrictDomainsToCertificate = $true
    TlsSenderCertificateName = "signatures.esignify.io"
    Comment = "Accepts emails returning from ESignify with signatures applied"
}

# Remove existing connector if present
$existing = Get-InboundConnector -Identity "ESignify Signature Service - Inbound" -ErrorAction SilentlyContinue
if ($existing) {
    Remove-InboundConnector -Identity "ESignify Signature Service - Inbound" -Confirm:$false
    Write-Host "Removed existing inbound connector" -ForegroundColor Yellow
}

New-InboundConnector @InboundConnectorParams
Write-Host "Created inbound connector from ESignify" -ForegroundColor Green

# STEP 4: Create Transport Rule
# -----------------------------
# This rule identifies emails that need signatures and routes them

$TransportRuleParams = @{
    Name = "ESignify - Route to Signature Service"
    Priority = 0
    FromScope = "InOrganization"
    SentToScope = "NotInOrganization"
    RouteMessageOutboundConnector = "ESignify Signature Service - Outbound"
    SetHeaderName = "X-ESignify-TenantId"
    SetHeaderValue = "${tenantId}"
    Comments = "Routes outgoing external emails through ESignify for signature injection"
}

# Remove existing rule if present
$existing = Get-TransportRule -Identity "ESignify - Route to Signature Service" -ErrorAction SilentlyContinue
if ($existing) {
    Remove-TransportRule -Identity "ESignify - Route to Signature Service" -Confirm:$false
    Write-Host "Removed existing transport rule" -ForegroundColor Yellow
}

New-TransportRule @TransportRuleParams
Write-Host "Created transport rule for signature routing" -ForegroundColor Green

# STEP 5: Verify Configuration
# ----------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESignify Server-Side Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration Summary:" -ForegroundColor White
Write-Host "  Outbound Connector: ESignify Signature Service - Outbound" -ForegroundColor Gray
Write-Host "  Inbound Connector:  ESignify Signature Service - Inbound" -ForegroundColor Gray
Write-Host "  Transport Rule:     ESignify - Route to Signature Service" -ForegroundColor Gray
Write-Host "  Tenant ID:          ${tenantId}" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Wait 15-30 minutes for changes to propagate" -ForegroundColor White
Write-Host "  2. Send a test email to an external address" -ForegroundColor White
Write-Host "  3. Verify signature is automatically appended" -ForegroundColor White
Write-Host ""

# To verify connectors:
# Get-OutboundConnector | Where-Object {$_.Name -like "ESignify*"}
# Get-InboundConnector | Where-Object {$_.Name -like "ESignify*"}
# Get-TransportRule | Where-Object {$_.Name -like "ESignify*"}

# To disable (not remove):
# Disable-TransportRule -Identity "ESignify - Route to Signature Service"

# To completely remove ESignify:
# Remove-TransportRule -Identity "ESignify - Route to Signature Service" -Confirm:$false
# Remove-OutboundConnector -Identity "ESignify Signature Service - Outbound" -Confirm:$false
# Remove-InboundConnector -Identity "ESignify Signature Service - Inbound" -Confirm:$false
`;
  };

  // Generate removal script
  const generateRemovalScript = () => {
    return `# ESignify - Remove Server-Side Configuration
# Run this to completely remove ESignify from your Exchange Online

Connect-ExchangeOnline -UserPrincipalName admin@${domainName}

# Remove transport rule
Remove-TransportRule -Identity "ESignify - Route to Signature Service" -Confirm:$false
Write-Host "Removed transport rule" -ForegroundColor Green

# Remove connectors
Remove-OutboundConnector -Identity "ESignify Signature Service - Outbound" -Confirm:$false
Write-Host "Removed outbound connector" -ForegroundColor Green

Remove-InboundConnector -Identity "ESignify Signature Service - Inbound" -Confirm:$false
Write-Host "Removed inbound connector" -ForegroundColor Green

Write-Host ""
Write-Host "ESignify has been completely removed from your Exchange Online configuration." -ForegroundColor Cyan
`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="deployment-methods-page">
      <div>
        <h1 className="text-3xl font-bold" style={{fontFamily: 'Outfit'}}>Server-Side Deployment</h1>
        <p className="text-muted-foreground mt-1">Automatic email signatures for all outgoing emails - no user action required</p>
      </div>

      {/* How it Works */}
      <Card className="border-2 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Server className="h-5 w-5" />
            How Server-Side Deployment Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-sm font-medium">User Sends Email</p>
              <p className="text-xs text-muted-foreground">From Outlook/Gmail/Mobile</p>
            </div>
            <div className="text-2xl text-blue-400">→</div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                <Server className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-sm font-medium">Exchange Routes to ESignify</p>
              <p className="text-xs text-muted-foreground">Via Transport Rule</p>
            </div>
            <div className="text-2xl text-blue-400">→</div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <Settings className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm font-medium">ESignify Adds Signature</p>
              <p className="text-xs text-muted-foreground">Personalized per employee</p>
            </div>
            <div className="text-2xl text-green-400">→</div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm font-medium">Email Delivered</p>
              <p className="text-xs text-muted-foreground">With signature attached</p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 mt-4">
            <h4 className="font-medium mb-2">Key Benefits:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✅ <strong>100% Coverage</strong> - Every outgoing email gets a signature, regardless of device or client</li>
              <li>✅ <strong>No User Action</strong> - Signatures are added automatically at the server level</li>
              <li>✅ <strong>Personalized</strong> - Each employee gets their own signature with their details</li>
              <li>✅ <strong>Instant Updates</strong> - Change a signature template and it applies immediately to all emails</li>
              <li>✅ <strong>Compliance</strong> - Ensure every email includes required legal disclaimers</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="microsoft365" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="microsoft365" className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 23 23" fill="currentColor">
              <path d="M0 0h11v11H0V0zm12 0h11v11H12V0zM0 12h11v11H0V12zm12 0h11v11H12V12z"/>
            </svg>
            Microsoft 365 / Exchange
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google Workspace
          </TabsTrigger>
        </TabsList>

        {/* Microsoft 365 Tab */}
        <TabsContent value="microsoft365">
          <div className="space-y-4">
            {/* Domain Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="domain">Your Domain</Label>
                    <Input 
                      id="domain"
                      value={domainName}
                      onChange={(e) => setDomainName(e.target.value)}
                      placeholder="yourdomain.com"
                      className="max-w-sm"
                    />
                    <p className="text-xs text-muted-foreground">Your Microsoft 365 domain (e.g., contoso.com)</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Tenant ID</Label>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-3 py-2 rounded text-sm">{tenantId}</code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(tenantId, 'tenantid')}
                      >
                        {copied === 'tenantid' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Your ESignify tenant identifier</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Setup Script */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      PowerShell Setup Script
                      <Badge className="bg-green-100 text-green-800">Server-Side</Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Complete Exchange Online configuration for automatic signature injection
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Prerequisites
                  </h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Exchange Online Administrator or Global Administrator role</li>
                    <li>• PowerShell 5.1 or higher</li>
                    <li>• ExchangeOnlineManagement module installed</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Setup Script</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generateServerSideScript(), 'setup')}
                    >
                      {copied === 'setup' ? <CheckCircle className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(generateServerSideScript(), 'esignify-setup.ps1')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download .ps1
                    </Button>
                  </div>
                </div>
                <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg text-xs overflow-x-auto max-h-96 whitespace-pre-wrap">
                  {generateServerSideScript()}
                </pre>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">📋 Quick Start Guide</h4>
                  <ol className="text-sm text-blue-700 space-y-2">
                    <li><strong>1.</strong> Open PowerShell as Administrator</li>
                    <li><strong>2.</strong> Install the Exchange module:
                      <code className="block bg-blue-100 px-2 py-1 rounded mt-1 text-xs">Install-Module -Name ExchangeOnlineManagement -Force</code>
                    </li>
                    <li><strong>3.</strong> Download and run the setup script above</li>
                    <li><strong>4.</strong> Wait 15-30 minutes for changes to propagate</li>
                    <li><strong>5.</strong> Send a test email to verify signatures are applied</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* Removal Script */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Removal Script
                </CardTitle>
                <CardDescription>
                  Use this script to completely remove ESignify from your Exchange configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Remove all ESignify connectors and rules</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(generateRemovalScript(), 'esignify-remove.ps1')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download Removal Script
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* API Endpoint Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Signature Processing Endpoint
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Email Signature API</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-muted px-3 py-2 rounded text-sm flex-1">
                        {API_URL}/api/signatures/process
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(`${API_URL}/api/signatures/process`, 'api')}
                      >
                        {copied === 'api' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This endpoint receives emails, looks up the sender, and injects their personalized signature
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Google Workspace Tab */}
        <TabsContent value="google">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google Workspace Server-Side Deployment
                <Badge variant="outline">Coming Soon</Badge>
              </CardTitle>
              <CardDescription>
                Automatic signature injection for Gmail users via Google Admin SDK
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Google Workspace Integration</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Server-side signature deployment for Google Workspace is coming soon. 
                  This will use the Gmail API to automatically set signatures for all users.
                </p>
                <Button variant="outline" asChild>
                  <a href="https://developers.google.com/gmail/api/reference/rest/v1/users.settings.sendAs" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Gmail API Documentation
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
