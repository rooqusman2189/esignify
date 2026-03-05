import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Building2, Mail } from 'lucide-react';

export const Settings = () => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTenant();
  }, []);

  const loadTenant = async () => {
    try {
      const res = await api.get('/api/tenants/me');
      if (res.data.success) {
        setTenant(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold" style={{fontFamily: 'Outfit'}}>Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Settings */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle style={{fontFamily: 'Outfit'}}>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={user?.name || ''} disabled />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={user?.role || ''} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Organization Settings */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle style={{fontFamily: 'Outfit'}}>Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Organization Name</Label>
              <Input value={tenant?.name || ''} disabled />
            </div>
            <div>
              <Label>Organization ID</Label>
              <Input value={tenant?.tenant_id || ''} disabled />
            </div>
            <div>
              <Label>Status</Label>
              <Input value={tenant?.status || ''} disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Information */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle style={{fontFamily: 'Outfit'}}>API Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-[#F4F4F5] p-4 rounded-md border border-border">
            <p className="text-sm font-medium mb-2">Tenant ID</p>
            <code className="text-xs">{tenant?.tenant_id}</code>
          </div>
          <p className="text-sm text-muted-foreground">
            Use this tenant ID for API integrations and deployments.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
