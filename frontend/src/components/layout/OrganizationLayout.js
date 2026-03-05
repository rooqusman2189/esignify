import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronLeft, Users, FileText, BarChart3, Settings, History, Server } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '@/hooks/use-toast';

export const OrganizationLayout = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [organization, setOrganization] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganization();
  }, [orgId]);

  const fetchOrganization = async () => {
    try {
      const response = await api.get(`/api/organizations/${orgId}`);
      setOrganization(response.data.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load organization',
        variant: 'destructive',
      });
      navigate('/dashboard/organizations');
    } finally {
      setLoading(false);
    }
  };

  const orgNavItems = [
    { icon: BarChart3, label: 'Dashboard', path: `/dashboard/organization/${orgId}` },
    { icon: Users, label: 'Employees', path: `/dashboard/organization/${orgId}/employees` },
    { icon: FileText, label: 'Signatures', path: `/dashboard/organization/${orgId}/signatures` },
    { icon: BarChart3, label: 'Sites', path: `/dashboard/organization/${orgId}/sites` },
    { icon: Server, label: 'Server-Side Deploy', path: `/dashboard/organization/${orgId}/deploy` },
    { icon: History, label: 'History', path: `/dashboard/organization/${orgId}/deployments` },
    { icon: Settings, label: 'Settings', path: `/dashboard/organization/${orgId}/settings` },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <button
                onClick={() => navigate('/dashboard/organizations')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm">Back</span>
              </button>
              <div>
                <h1 className="text-lg font-bold">{organization?.name}</h1>
                <p className="text-xs text-gray-600">{organization?.id}</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-slate-50 border-r border-border transition-transform duration-300 lg:translate-x-0 lg:relative lg:top-0 lg:h-auto z-40`}
        >
          <nav className="p-4 space-y-2">
            {orgNavItems.map((item) => {
              const isActive = window.location.pathname === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            <Outlet context={{ organization, orgId }} />
          </div>
        </main>
      </div>
    </div>
  );
};
