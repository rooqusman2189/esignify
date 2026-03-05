import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Building2, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';

export const Sites = () => {
  const { orgId } = useParams();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: ''
  });

  useEffect(() => {
    loadSites();
  }, [orgId]);

  const loadSites = async () => {
    try {
      const endpoint = orgId ? `/api/organizations/${orgId}/sites` : '/api/sites';
      const res = await api.get(endpoint);
      if (res.data.success) {
        setSites(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      country: '',
      phone: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = orgId ? `/api/organizations/${orgId}/sites` : '/api/sites';
      const res = await api.post(endpoint, formData);
      if (res.data.success) {
        toast.success('Site added successfully');
        setDialogOpen(false);
        resetForm();
        loadSites();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add site');
    }
  };

  const handleEdit = (site) => {
    setSelectedSite(site);
    setFormData({
      name: site.name || '',
      address: site.address || '',
      city: site.city || '',
      country: site.country || '',
      phone: site.phone || ''
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const endpoint = orgId
        ? `/api/organizations/${orgId}/sites/${selectedSite.site_id}`
        : `/api/sites/${selectedSite.site_id}`;
      await api.patch(endpoint, formData);
      toast.success('Site updated successfully');
      setEditDialogOpen(false);
      resetForm();
      loadSites();
    } catch (error) {
      toast.error('Failed to update site');
    }
  };

  const handleDelete = async (siteId) => {
    if (!window.confirm('Are you sure you want to delete this site?')) return;
    
    try {
      const endpoint = orgId
        ? `/api/organizations/${orgId}/sites/${siteId}`
        : `/api/sites/${siteId}`;
      await api.delete(endpoint);
      toast.success('Site deleted');
      loadSites();
    } catch (error) {
      toast.error('Failed to delete site');
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
    <div className="space-y-6" data-testid="sites-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{fontFamily: 'Outfit'}}>Sites</h1>
          <p className="text-muted-foreground mt-1">Manage your organization's locations and branches</p>
        </div>
        <Button 
          onClick={() => setDialogOpen(true)} 
          className="bg-[#2563EB] hover:bg-[#1D4ED8]"
          data-testid="add-site-btn"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Site
        </Button>
      </div>

      {/* Add Site Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Add New Site</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Site Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Headquarters"
                required
                data-testid="site-name-input"
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="123 Business Ave"
                data-testid="site-address-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  placeholder="New York"
                  data-testid="site-city-input"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                  placeholder="USA"
                  data-testid="site-country-input"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="+1 (555) 000-0000"
                data-testid="site-phone-input"
              />
            </div>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" data-testid="submit-site-btn">
              Add Site
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Edit Site</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Site Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_address">Address</Label>
              <Input
                id="edit_address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_city">City</Label>
                <Input
                  id="edit_city"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_country">Country</Label>
                <Input
                  id="edit_country"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
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
              Update Site
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="border border-border">
        <CardContent className="p-0">
          {sites.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-sites">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No sites yet. Add your first location to get started.</p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Site
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.site_id} data-testid={`site-row-${site.site_id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        {site.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {site.address ? (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                          {site.address}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{site.city || '-'}</TableCell>
                    <TableCell>{site.country || '-'}</TableCell>
                    <TableCell>
                      {site.phone ? (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-1 text-muted-foreground" />
                          {site.phone}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(site)}
                          data-testid={`edit-site-${site.site_id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(site.site_id)}
                          data-testid={`delete-site-${site.site_id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
