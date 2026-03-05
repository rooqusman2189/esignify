import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, FileText, CheckCircle2, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [showTenantSetup, setShowTenantSetup] = useState(false);
  const [showSitesDialog, setShowSitesDialog] = useState(false);
  const [tenantData, setTenantData] = useState({ name: '', tenant_id: '', sites: [] });
  const [newSite, setNewSite] = useState({ site_id: '', name: '', address: '', phone: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const tenantRes = await api.get('/api/tenants/me');
      if (tenantRes.data.success) {
        setTenant(tenantRes.data.data);
        loadAnalytics();
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setShowTenantSetup(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await api.get('/api/analytics/dashboard');
      if (res.data.success) {
        setAnalytics(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/tenants', tenantData);
      if (res.data.success) {
        toast.success('Organization created successfully!');
        setTenant(res.data.data);
        setShowTenantSetup(false);
        loadAnalytics();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create organization');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="dashboard-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (showTenantSetup) {
    return (
      <div className="max-w-2xl mx-auto" data-testid="tenant-setup">
        <Card>
          <CardHeader>
            <CardTitle style={{fontFamily: 'Outfit'}}>Setup Your Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  value={tenantData.name}
                  onChange={(e) => setTenantData({...tenantData, name: e.target.value})}
                  placeholder="Acme Corporation"
                  required
                  data-testid="org-name-input"
                />
              </div>
              <div>
                <Label htmlFor="tenant_id">Organization ID (slug)</Label>
                <Input
                  id="tenant_id"
                  value={tenantData.tenant_id}
                  onChange={(e) => setTenantData({...tenantData, tenant_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                  placeholder="acme"
                  required
                  data-testid="org-id-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for identification (lowercase, no spaces)
                </p>
              </div>
              <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" data-testid="create-org-btn">
                Create Organization
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard-main">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{fontFamily: 'Outfit'}}>
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. Here's what's happening with {tenant?.name}.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border hover:shadow-md transition-shadow" data-testid="stat-employees">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-8 w-8 text-[#2563EB]" strokeWidth={1.5} />
              <span className="text-2xl font-bold" style={{fontFamily: 'Outfit'}}>
                {analytics?.total_employees || 0}
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
          </CardContent>
        </Card>

        <Card className="border border-border hover:shadow-md transition-shadow" data-testid="stat-deployed">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-8 w-8 text-[#16A34A]" strokeWidth={1.5} />
              <span className="text-2xl font-bold" style={{fontFamily: 'Outfit'}}>
                {analytics?.deployed_signatures || 0}
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Deployed Signatures</p>
          </CardContent>
        </Card>

        <Card className="border border-border hover:shadow-md transition-shadow" data-testid="stat-pending">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-[#D97706]" strokeWidth={1.5} />
              <span className="text-2xl font-bold" style={{fontFamily: 'Outfit'}}>
                {analytics?.pending_deployments || 0}
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Pending Deployments</p>
          </CardContent>
        </Card>

        <Card className="border border-border hover:shadow-md transition-shadow" data-testid="stat-templates">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-8 w-8 text-[#2563EB]" strokeWidth={1.5} />
              <span className="text-2xl font-bold" style={{fontFamily: 'Outfit'}}>
                {analytics?.active_templates || 0}
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Active Templates</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle style={{fontFamily: 'Outfit'}}>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-start justify-center space-y-2 hover:bg-[#F4F4F5]"
              onClick={() => navigate('/dashboard/employees')}
              data-testid="quick-action-add-employee"
            >
              <Users className="h-6 w-6 text-[#2563EB]" />
              <div className="text-left">
                <div className="font-semibold">Add Employees</div>
                <div className="text-xs text-muted-foreground">Manage your team members</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-start justify-center space-y-2 hover:bg-[#F4F4F5]"
              onClick={() => navigate('/dashboard/signatures')}
              data-testid="quick-action-create-signature"
            >
              <FileText className="h-6 w-6 text-[#2563EB]" />
              <div className="text-left">
                <div className="font-semibold">Create Signature</div>
                <div className="text-xs text-muted-foreground">Design email templates</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-start justify-center space-y-2 hover:bg-[#F4F4F5]"
              data-testid="quick-action-view-docs"
            >
              <TrendingUp className="h-6 w-6 text-[#2563EB]" />
              <div className="text-left">
                <div className="font-semibold">View Analytics</div>
                <div className="text-xs text-muted-foreground">Track deployment stats</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      {analytics?.total_employees === 0 && (
        <Card className="border border-[#2563EB] bg-blue-50/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-1">
                <h3 className="font-semibold mb-2" style={{fontFamily: 'Outfit'}}>
                  Get Started with ESignify
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first employees and create email signature templates to get started.
                </p>
                <Button
                  size="sm"
                  className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                  onClick={() => navigate('/dashboard/employees')}
                  data-testid="get-started-btn"
                >
                  Add Employees <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
