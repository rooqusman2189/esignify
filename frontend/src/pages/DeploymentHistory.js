import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { History, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export const DeploymentHistory = () => {
  const [deployments, setDeployments] = useState([]);
  const [employees, setEmployees] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [deploymentsRes, employeesRes] = await Promise.all([
        api.get('/api/deployments/history'),
        api.get('/api/employees')
      ]);

      if (deploymentsRes.data.success) {
        setDeployments(deploymentsRes.data.data);
      }

      if (employeesRes.data.success) {
        const empMap = {};
        employeesRes.data.data.forEach(emp => {
          empMap[emp.employee_id] = emp;
        });
        setEmployees(empMap);
      }
    } catch (error) {
      toast.error('Failed to load deployment history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDeployments = deployments.filter(dep => {
    const employee = employees[dep.employee_id];
    const employeeName = employee 
      ? `${employee.first_name} ${employee.last_name}`.toLowerCase()
      : '';
    const matchesSearch = employeeName.includes(searchTerm.toLowerCase()) ||
      dep.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || dep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: deployments.length,
    successful: deployments.filter(d => d.status === 'success').length,
    failed: deployments.filter(d => d.status === 'failed').length,
    today: deployments.filter(d => {
      const depDate = new Date(d.deployed_at);
      const today = new Date();
      return depDate.toDateString() === today.toDateString();
    }).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="deployment-history-page">
      <div>
        <h1 className="text-3xl font-bold" style={{fontFamily: 'Outfit'}}>Deployment History</h1>
        <p className="text-muted-foreground mt-1">View all signature deployments across your organization</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deployments</p>
                <p className="text-2xl font-bold" style={{fontFamily: 'Outfit'}}>{stats.total}</p>
              </div>
              <History className="h-8 w-8 text-[#2563EB]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-600" style={{fontFamily: 'Outfit'}}>{stats.successful}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600" style={{fontFamily: 'Outfit'}}>{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold text-[#2563EB]" style={{fontFamily: 'Outfit'}}>{stats.today}</p>
              </div>
              <Clock className="h-8 w-8 text-[#2563EB]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="deployment-search-input"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployments Table */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {filteredDeployments.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-deployments">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {deployments.length === 0 
                  ? 'No deployments yet. Deploy signatures to employees to see history here.'
                  : 'No deployments match your filters.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Signature ID</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deployed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeployments.map((deployment) => {
                  const employee = employees[deployment.employee_id];
                  return (
                    <TableRow key={deployment.deployment_id} data-testid={`deployment-row-${deployment.deployment_id}`}>
                      <TableCell className="font-medium">
                        {employee 
                          ? `${employee.first_name} ${employee.last_name}`
                          : deployment.employee_id}
                        {employee && (
                          <div className="text-xs text-muted-foreground">{employee.email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-[#F4F4F5] px-2 py-1 rounded">
                          {deployment.signature_id}
                        </code>
                      </TableCell>
                      <TableCell className="capitalize">{deployment.method || 'manual'}</TableCell>
                      <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                      <TableCell>{formatDate(deployment.deployed_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
