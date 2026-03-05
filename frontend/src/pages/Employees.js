import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Upload, Download, MoreVertical, Send, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Employees = () => {
  const { orgId } = useParams();
  const [employees, setEmployees] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkDeployDialogOpen, setBulkDeployDialogOpen] = useState(false);
  const [assignSiteDialogOpen, setAssignSiteDialogOpen] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [deployedHTML, setDeployedHTML] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    title: '',
    department: '',
    phone: ''
  });

  useEffect(() => {
    loadEmployees();
    loadSignatures();
    loadSites();
  }, [orgId]);

  const loadEmployees = async () => {
    try {
      const endpoint = orgId ? `/api/organizations/${orgId}/employees` : '/api/employees';
      const res = await api.get(endpoint);
      if (res.data.success) {
        setEmployees(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const loadSignatures = async () => {
    try {
      const endpoint = orgId ? `/api/organizations/${orgId}/signatures` : '/api/signatures';
      const res = await api.get(endpoint);
      if (res.data.success) {
        setSignatures(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load signatures');
    }
  };

  const loadSites = async () => {
    try {
      const endpoint = orgId ? `/api/organizations/${orgId}/sites` : '/api/sites';
      const res = await api.get(endpoint);
      if (res.data.success) {
        setSites(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load sites');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = orgId ? `/api/organizations/${orgId}/employees` : '/api/employees';
      const res = await api.post(endpoint, formData);
      if (res.data.success) {
        toast.success('Employee added successfully');
        setDialogOpen(false);
        setFormData({
          email: '',
          first_name: '',
          last_name: '',
          title: '',
          department: '',
          phone: ''
        });
        loadEmployees();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add employee');
    }
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    
    try {
      const endpoint = orgId
        ? `/api/organizations/${orgId}/employees/${employeeId}`
        : `/api/employees/${employeeId}`;
      await api.delete(endpoint);
      toast.success('Employee deleted');
      loadEmployees();
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      email: employee.email,
      first_name: employee.first_name,
      last_name: employee.last_name,
      title: employee.title || '',
      department: employee.department || '',
      phone: employee.phone || ''
    });
    setEditDialogOpen(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    try {
      const endpoint = orgId
        ? `/api/organizations/${orgId}/employees/${selectedEmployee.employee_id}`
        : `/api/employees/${selectedEmployee.employee_id}`;
      await api.patch(endpoint, formData);
      toast.success('Employee updated successfully');
      setEditDialogOpen(false);
      loadEmployees();
    } catch (error) {
      toast.error('Failed to update employee');
    }
  };

  const handleDeploy = async (employee) => {
    if (!employee.assigned_signature_id) {
      toast.error('No signature assigned to this employee');
      return;
    }

    try {
      const response = await api.post(`/api/deployments/generate?employee_id=${employee.employee_id}`);
      if (response.data.success) {
        setDeployedHTML(response.data.data.html);
        setSelectedEmployee(employee);
        setDeployDialogOpen(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate signature');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(deployedHTML);
    toast.success('Signature HTML copied to clipboard!');
  };

  const handleBulkAssign = async () => {
    if (!selectedSignatureId) {
      toast.error('Please select a signature');
      return;
    }

    if (selectedEmployees.length === 0) {
      toast.error('Please select employees');
      return;
    }

    try {
      await api.post('/api/employees/assign-signature', {
        employee_ids: selectedEmployees,
        signature_id: selectedSignatureId,
      });
      toast.success(`Signature assigned to ${selectedEmployees.length} employees`);
      setBulkAssignDialogOpen(false);
      setSelectedEmployees([]);
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign signatures');
      console.error(error);
    }
  };

  const handleBulkDeploy = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select employees');
      return;
    }

    setDeploying(true);
    try {
      const response = await api.post('/api/deployments/bulk-deploy', {
        employee_ids: selectedEmployees,
        method: 'manual'
      });

      if (response.data.success) {
        const { successful, failed } = response.data.data;
        toast.success(`Deployed ${successful} signatures successfully! ${failed > 0 ? `${failed} failed.` : ''}`);
        setBulkDeployDialogOpen(false);
        setSelectedEmployees([]);
        loadEmployees();
      }
    } catch (error) {
      toast.error('Bulk deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleAssignSite = async () => {
    if (!selectedEmployee || !selectedSiteId) {
      toast.error('Please select a site');
      return;
    }

    try {
      const endpoint = orgId
        ? `/api/organizations/${orgId}/employees/assign-site`
        : '/api/employees/assign-site';
      await api.post(endpoint, {
        employee_id: selectedEmployee.employee_id,
        site_id: selectedSiteId
      });
      toast.success('Site assigned successfully');
      setAssignSiteDialogOpen(false);
      setSelectedSiteId('');
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign site');
    }
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(e => e.employee_id));
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setImporting(true);
    try {
      const response = await api.post('/api/employees/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const { imported, failed, errors } = response.data.data;
        
        if (failed > 0) {
          toast.warning(`Imported ${imported} employees. ${failed} failed.`, {
            description: errors.map(e => `Row ${e.row}: ${e.error}`).join('\n')
          });
        } else {
          toast.success(`Successfully imported ${imported} employees!`);
        }
        
        setImportDialogOpen(false);
        loadEmployees();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import employees');
    } finally {
      setImporting(false);
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
    <div className="space-y-6" data-testid="employees-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{fontFamily: 'Outfit'}}>Employees</h1>
          <p className="text-muted-foreground mt-1">Manage your team members and their signatures</p>
        </div>
        <div className="flex space-x-2">
          {selectedEmployees.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setBulkAssignDialogOpen(true)}
                data-testid="bulk-assign-btn"
              >
                Assign Signature ({selectedEmployees.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => setBulkDeployDialogOpen(true)}
                data-testid="bulk-deploy-btn"
              >
                Deploy All ({selectedEmployees.length})
              </Button>
            </>
          )}
          
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="import-employees-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle style={{fontFamily: 'Outfit'}}>Import Employees from CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>CSV File</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileImport}
                    disabled={importing}
                    data-testid="csv-file-input"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Required columns: email, first_name, last_name<br/>
                    Optional: title, department, phone
                  </p>
                </div>
                <div className="bg-[#F4F4F5] p-4 rounded-md border border-border">
                  <p className="text-sm font-medium mb-2">Sample CSV format:</p>
                  <code className="text-xs block">
                    email,first_name,last_name,title,department<br/>
                    john@company.com,John,Doe,Manager,Sales
                  </code>
                </div>
                {importing && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3">Importing employees...</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Button onClick={() => setDialogOpen(true)} className="bg-[#2563EB] hover:bg-[#1D4ED8]" data-testid="add-employee-btn">
            <Plus className="h-4 w-4 mr-2" /> Add Employee
          </Button>
        </div>
      </div>
      {/* Add Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Add New Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                    data-testid="employee-first-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    required
                    data-testid="employee-last-name-input"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  data-testid="employee-email-input"
                />
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Marketing Manager"
                  data-testid="employee-title-input"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  placeholder="Marketing"
                  data-testid="employee-department-input"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+1 (555) 123-4567"
                  data-testid="employee-phone-input"
                />
              </div>
              <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" data-testid="submit-employee-btn">
                Add Employee
              </Button>
            </form>
          </DialogContent>
        </Dialog>

      <Card className="border border-border">
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-employees">
              <p className="text-muted-foreground mb-4">No employees yet. Add your first employee to get started.</p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Employee
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <button onClick={selectAll} data-testid="select-all-btn">
                      {selectedEmployees.length === employees.length ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.employee_id} data-testid={`employee-row-${employee.employee_id}`}>
                    <TableCell>
                      <button
                        onClick={() => toggleEmployeeSelection(employee.employee_id)}
                        data-testid={`select-employee-${employee.employee_id}`}
                      >
                        {selectedEmployees.includes(employee.employee_id) ? (
                          <CheckSquare className="h-5 w-5 text-[#2563EB]" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.title || '-'}</TableCell>
                    <TableCell>{employee.department || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        employee.deployment_status === 'deployed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {employee.deployment_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`employee-actions-${employee.employee_id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(employee)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeploy(employee)}>
                            <Send className="h-4 w-4 mr-2" />
                            Deploy Signature
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedEmployee(employee);
                            setAssignSiteDialogOpen(true);
                          }}>
                            <Send className="h-4 w-4 mr-2" />
                            Assign Site
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(employee.employee_id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_first_name">First Name</Label>
                <Input
                  id="edit_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Last Name</Label>
                <Input
                  id="edit_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_title">Title</Label>
              <Input
                id="edit_title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="edit_department">Department</Label>
              <Input
                id="edit_department"
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]">
              Update Employee
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deploy Signature Dialog */}
      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Deploy Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Signature for: <strong>{selectedEmployee?.first_name} {selectedEmployee?.last_name}</strong>
              </p>
            </div>
            
            <div>
              <Label>Preview</Label>
              <div 
                className="border border-border rounded-lg p-4 bg-[#F4F4F5] max-h-48 overflow-auto"
                dangerouslySetInnerHTML={{ __html: deployedHTML }}
              />
            </div>

            <div>
              <Label>HTML Code</Label>
              <Textarea
                value={deployedHTML}
                readOnly
                rows={8}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={copyToClipboard}
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                Copy to Clipboard
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeployDialogOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">How to deploy:</p>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Copy the HTML code above</li>
                <li>Open your email client settings</li>
                <li>Navigate to signature settings</li>
                <li>Paste the HTML code</li>
                <li>Save and apply</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Assign Signature to Selected Employees</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Signature Template</Label>
              <Select value={selectedSignatureId} onValueChange={setSelectedSignatureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a signature template" />
                </SelectTrigger>
                <SelectContent>
                  {signatures.map(sig => (
                    <SelectItem key={sig.signature_id} value={sig.signature_id}>
                      {sig.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              This will assign the selected signature to {selectedEmployees.length} employees
            </p>
            <div className="flex space-x-2">
              <Button
                onClick={handleBulkAssign}
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8]"
                disabled={!selectedSignatureId}
              >
                Assign to {selectedEmployees.length} Employees
              </Button>
              <Button
                variant="outline"
                onClick={() => setBulkAssignDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Deploy Dialog */}
      <Dialog open={bulkDeployDialogOpen} onOpenChange={setBulkDeployDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Deploy Signatures</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deploy signatures to {selectedEmployees.length} selected employees
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Note:</p>
              <p className="text-sm text-muted-foreground">
                This will mark signatures as deployed. For automated deployment to Office 365/Google Workspace,
                configure integrations in Settings.
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleBulkDeploy}
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8]"
                disabled={deploying}
              >
                {deploying ? 'Deploying...' : `Deploy to ${selectedEmployees.length} Employees`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setBulkDeployDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Site Dialog */}
      <Dialog open={assignSiteDialogOpen} onOpenChange={setAssignSiteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Assign Site to Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEmployee && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Assigning site to: <strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong>
                </p>
              </div>
            )}
            <div>
              <Label>Select Site</Label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(site => (
                    <SelectItem key={site.site_id} value={site.site_id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sites.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sites available. Create a site first to assign.
              </p>
            )}
            <div className="flex space-x-2">
              <Button
                onClick={handleAssignSite}
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8]"
                disabled={!selectedSiteId || sites.length === 0}
              >
                Assign Site
              </Button>
              <Button
                variant="outline"
                onClick={() => setAssignSiteDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default Employees;
