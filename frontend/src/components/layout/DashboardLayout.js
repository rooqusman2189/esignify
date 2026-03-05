import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Mail, Users, FileText, BarChart3, Settings, LogOut, Menu, X, Building2, History, Server } from 'lucide-react';

export const DashboardLayout = () => {
  const { user, logout, checkAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);

  useEffect(() => {
    if (location.state?.user) {
      setIsAuthenticated(true);
      return;
    }

    const verifyAuth = async () => {
      try {
        await checkAuth();
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        navigate('/login');
      }
    };

    verifyAuth();
  }, [location.state, checkAuth, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
    { icon: Building2, label: 'Organizations', path: '/dashboard/organizations' },
    { icon: Users, label: 'Employees', path: '/dashboard/employees' },
    { icon: FileText, label: 'Signatures', path: '/dashboard/signatures' },
    { icon: Building2, label: 'Sites', path: '/dashboard/sites' },
    { icon: Server, label: 'Server-Side Deploy', path: '/dashboard/deploy' },
    { icon: History, label: 'History', path: '/dashboard/deployments' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
  ];

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white" data-testid="dashboard-layout">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
                data-testid="mobile-menu-btn"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div className="flex items-center space-x-2">
                <Mail className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold" style={{fontFamily: 'Outfit'}}>ESignify</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {user?.picture && (
                  <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full" />
                )}
                <div className="hidden sm:block text-sm">
                  <div className="font-medium">{user?.name}</div>
                  <div className="text-muted-foreground text-xs">{user?.email}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#F4F4F5] border-r border-border
          transform transition-transform duration-200 ease-in-out lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          mt-16 lg:mt-0
        `}>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-md text-sm font-medium
                    transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-white text-primary border border-border shadow-sm'
                        : 'text-muted-foreground hover:bg-white hover:text-foreground'
                    }
                  `}
                  data-testid={`nav-${item.label.toLowerCase()}-btn`}
                >
                  <item.icon className="h-5 w-5" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};
