import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Signatures } from './pages/Signatures';
import { Sites } from './pages/Sites';
import { DeploymentHistory } from './pages/DeploymentHistory';
import { DeploymentMethods } from './pages/DeploymentMethods';
import { Settings } from './pages/Settings';
import Organizations from './pages/Organizations';
import OrganizationMembers from './pages/OrganizationMembers';
import OrganizationDashboard from './pages/OrganizationDashboard';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OrganizationLayout } from './components/layout/OrganizationLayout';
import '@/App.css';

function AppRouter() {
  const location = useLocation();
  
  // Check for OAuth callbacks in URL hash (Google session_id or Microsoft tokens)
  if (location.hash?.includes('session_id=') || 
      location.hash?.includes('access_token=') || 
      location.hash?.includes('id_token=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="organization/:orgId/members" element={<OrganizationMembers />} />
        <Route path="employees" element={<Employees />} />
        <Route path="signatures" element={<Signatures />} />
        <Route path="sites" element={<Sites />} />
        <Route path="deployments" element={<DeploymentHistory />} />
        <Route path="deploy" element={<DeploymentMethods />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Organization-scoped routes */}
      <Route path="/dashboard/organization/:orgId" element={<OrganizationLayout />}>
        <Route index element={<OrganizationDashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="signatures" element={<Signatures />} />
        <Route path="sites" element={<Sites />} />
        <Route path="deployments" element={<DeploymentHistory />} />
        <Route path="deploy" element={<DeploymentMethods />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
