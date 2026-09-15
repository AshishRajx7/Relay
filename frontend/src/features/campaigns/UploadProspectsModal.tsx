import React, { useState } from 'react';
import { Upload, X, AlertCircle, FileText } from 'lucide-react';
import { campaignService } from '../../services/campaignService';

interface UploadProspectsModalProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadProspectsModal: React.FC<UploadProspectsModalProps> = ({
  campaignId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await campaignService.uploadProspects(campaignId, file);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-relay-card border border-relay-border rounded-lg w-full max-w-md p-6 shadow-operator-lg">
        <div className="flex items-center justify-between pb-4 border-b border-relay-border">
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-relay-text">
            Upload Prospect Contacts
          </h3>
          <button
            onClick={onClose}
            className="text-relay-muted hover:text-relay-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <p className="text-xs text-relay-muted">
            Upload a CSV or PDF file containing company prospect contact emails. Contacts will be extracted and queued for research.
          </p>

          <div className="border-2 border-dashed border-relay-border rounded-lg p-6 flex flex-col items-center justify-center bg-relay-bg/50 hover:border-relay-border-light transition-colors">
            <Upload className="w-8 h-8 text-relay-muted/70 mb-2" />
            <input
              type="file"
              accept=".csv,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs text-relay-muted file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-mono file:bg-relay-card file:text-relay-text hover:file:bg-relay-border"
            />
            {file && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-relay-accent font-mono">
                <FileText className="w-3.5 h-3.5" />
                <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded bg-relay-danger-muted border border-relay-danger/30 text-xs text-relay-danger flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-relay-border">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-mono rounded border border-relay-border text-relay-muted hover:text-relay-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingesting...' : 'Upload & Enqueue'}
          </button>
        </div>
      </div>
    </div>
  );
};
