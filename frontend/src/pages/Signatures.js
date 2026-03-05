import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export const Signatures = () => {
  const { orgId } = useParams();
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    html_template: '',
    template_fields: ['first_name', 'last_name', 'title', 'email', 'phone']
  });

  useEffect(() => {
    loadSignatures();
  }, [orgId]);

  const loadSignatures = async () => {
    try {
      const endpoint = orgId ? `/api/organizations/${orgId}/signatures` : '/api/signatures';
      const res = await api.get(endpoint);
      if (res.data.success) {
        setSignatures(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load signatures');
    } finally {
      setLoading(false);
    }
  };

  const defaultTemplate = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p style="margin: 0; font-weight: bold;">{{first_name}} {{last_name}}</p>
  <p style="margin: 5px 0; color: #666;">{{title}}</p>
  <p style="margin: 5px 0;">{{email}}</p>
  <p style="margin: 5px 0;">{{phone}}</p>
</div>`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        html_template: formData.html_template || defaultTemplate,
        css_styles: ''
      };
      const endpoint = orgId ? `/api/organizations/${orgId}/signatures` : '/api/signatures';
      const res = await api.post(endpoint, submitData);
      if (res.data.success) {
        toast.success('Signature template created');
        setDialogOpen(false);
        setFormData({
          name: '',
          description: '',
          html_template: '',
          template_fields: ['first_name', 'last_name', 'title', 'email', 'phone']
        });
        loadSignatures();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create signature');
    }
  };

  const handleDelete = async (signatureId) => {
    if (!window.confirm('Are you sure you want to delete this signature?')) return;
    
    try {
      const endpoint = orgId
        ? `/api/organizations/${orgId}/signatures/${signatureId}`
        : `/api/signatures/${signatureId}`;
      await api.delete(endpoint);
      toast.success('Signature deleted');
      loadSignatures();
    } catch (error) {
      toast.error('Failed to delete signature');
    }
  };

  const handlePreview = (signature) => {
    setSelectedSignature(signature);
    setPreviewDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="signatures-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{fontFamily: 'Outfit'}}>Signatures</h1>
          <p className="text-muted-foreground mt-1">Create and manage email signature templates</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]" data-testid="create-signature-btn">
              <Plus className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle style={{fontFamily: 'Outfit'}}>Create Signature Template</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Corporate Signature"
                  required
                  data-testid="signature-name-input"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Default signature for all employees"
                  data-testid="signature-description-input"
                />
              </div>
              <div>
                <Label htmlFor="html_template">HTML Template</Label>
                <Textarea
                  id="html_template"
                  value={formData.html_template || defaultTemplate}
                  onChange={(e) => setFormData({...formData, html_template: e.target.value})}
                  placeholder={defaultTemplate}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="signature-html-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use placeholders: {'{{first_name}}'}, {'{{last_name}}'}, {'{{title}}'}, {'{{email}}'}, {'{{phone}}'}
                </p>
              </div>
              <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" data-testid="submit-signature-btn">
                Create Template
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {signatures.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="text-center py-12" data-testid="empty-signatures">
            <p className="text-muted-foreground mb-4">No signature templates yet. Create your first template.</p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              <Plus className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {signatures.map((signature) => (
            <Card key={signature.signature_id} className="border border-border hover:shadow-md transition-shadow" data-testid={`signature-card-${signature.signature_id}`}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2" style={{fontFamily: 'Outfit'}}>
                  {signature.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {signature.description || 'No description'}
                </p>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(signature)}
                    data-testid={`preview-signature-${signature.signature_id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" /> Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(signature.signature_id)}
                    data-testid={`delete-signature-${signature.signature_id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{fontFamily: 'Outfit'}}>Signature Preview</DialogTitle>
          </DialogHeader>
          {selectedSignature && (
            <div className="space-y-4">
              <div className="border border-border rounded-lg p-4 bg-[#F4F4F5]">
                <div dangerouslySetInnerHTML={{ __html: selectedSignature.html_template }} />
              </div>
              <div>
                <Label>HTML Code</Label>
                <Textarea
                  value={selectedSignature.html_template}
                  readOnly
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
