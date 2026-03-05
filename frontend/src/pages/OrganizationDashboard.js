import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, FileText, Network } from 'lucide-react';

export default function OrganizationDashboard() {
  const { orgId } = useParams();
  const [stats, setStats] = useState({
    employees: 0,
    signatures: 0,
    sites: 0,
    deployments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [orgId]);

  const fetchStats = async () => {
    try {
      const employeesEndpoint = orgId ? `/api/organizations/${orgId}/employees` : '/api/employees';
      const signaturesEndpoint = orgId ? `/api/organizations/${orgId}/signatures` : '/api/signatures';
      const sitesEndpoint = orgId ? `/api/organizations/${orgId}/sites` : '/api/sites';
      const deploymentsEndpoint = orgId
        ? `/api/organizations/${orgId}/deployments/history`
        : '/api/deployments/history';

      const [empResult, sigResult, sitesResult, depResult] = await Promise.allSettled([
        api.get(employeesEndpoint),
        api.get(signaturesEndpoint),
        api.get(sitesEndpoint),
        api.get(deploymentsEndpoint),
      ]);

      const employees = empResult.status === 'fulfilled' ? (empResult.value.data.data || []) : [];
      const signatures = sigResult.status === 'fulfilled' ? (sigResult.value.data.data || []) : [];
      const sites = sitesResult.status === 'fulfilled' ? (sitesResult.value.data.data || []) : [];
      const deployments = depResult.status === 'fulfilled' ? (depResult.value.data.data || []) : [];

      setStats({
        employees: employees.length,
        signatures: signatures.length,
        sites: sites.length,
        deployments: deployments.length,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardCards = [
    {
      title: 'Employees',
      value: stats.employees,
      icon: Users,
      description: 'Total employees',
    },
    {
      title: 'Signatures',
      value: stats.signatures,
      icon: FileText,
      description: 'Email signatures',
    },
    {
      title: 'Sites',
      value: stats.sites,
      icon: Network,
      description: 'Office locations',
    },
    {
      title: 'Deployments',
      value: stats.deployments,
      icon: BarChart3,
      description: 'Completed deployments',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Organization Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your organization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-gray-600">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>Get started with your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href={`/dashboard/organization/${orgId}/sites`}
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold mb-1">Add a Site</h3>
              <p className="text-sm text-gray-600">Create your first office location</p>
            </a>

            <a
              href={`/dashboard/organization/${orgId}/signatures`}
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold mb-1">Create Signature</h3>
              <p className="text-sm text-gray-600">Design your email signature template</p>
            </a>

            <a
              href={`/dashboard/organization/${orgId}/employees`}
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold mb-1">Add Employees</h3>
              <p className="text-sm text-gray-600">Import or add employees manually</p>
            </a>

            <a
              href={`/dashboard/organization/${orgId}/deploy`}
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold mb-1">Deploy</h3>
              <p className="text-sm text-gray-600">Deploy signatures to your organization</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
