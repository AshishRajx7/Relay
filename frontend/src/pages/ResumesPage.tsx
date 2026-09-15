import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { resumeService } from '../services/resumeService';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';

export const ResumesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');

  // Fetch Resumes
  const { data: resumes, isLoading, refetch } = useQuery({
    queryKey: ['resumes-list'],
    queryFn: () => resumeService.getAll(),
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { file: File; label?: string }) =>
      resumeService.upload(data.file, data.label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes-list'] });
      setIsUploadOpen(false);
      setSelectedFile(null);
      setLabel('');
    },
  });

  // Re-parse Mutation
  const reparseMutation = useMutation({
    mutationFn: (id: string) => resumeService.reparse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes-list'] });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => resumeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes-list'] });
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    uploadMutation.mutate({ file: selectedFile, label: label.trim() || undefined });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-relay-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-relay-text flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-relay-accent" />
            Candidate Resumes
          </h1>
          <p className="text-xs text-relay-muted mt-1">
            Engineered candidate profiles, parsed skill graphs, and PDF resumes attached directly to Gmail outreach.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-xs rounded border border-relay-border text-relay-muted hover:text-relay-text bg-relay-card transition-colors"
            title="Refresh Resumes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Resume PDF
          </button>
        </div>
      </div>

      {/* Resumes List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
          Loading resumes...
        </div>
      ) : !resumes || resumes.length === 0 ? (
        <EmptyState
          title="No candidate resumes uploaded"
          description="Upload your PDF resume so Relay can parse your engineering skills, projects, and attach it to outgoing Gmail outreach."
          action={{
            label: "Upload Resume PDF",
            onClick: () => setIsUploadOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume, idx) => {
            const isFirst = idx === 0; // Top resume treated as active candidate profile

            return (
              <div
                key={resume.id}
                onClick={() => navigate(`/resumes/${resume.id}`)}
                className="p-5 rounded-lg border border-relay-border bg-relay-card hover:border-relay-border-light hover:bg-relay-card-hover cursor-pointer transition-all shadow-operator group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <StatusBadge status={resume.status} size="sm" />
                    {isFirst && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-relay-accent/40 bg-relay-accent/10 text-relay-accent font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Active Profile
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded bg-relay-bg border border-relay-border text-relay-accent">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-medium text-relay-text group-hover:text-relay-accent transition-colors truncate">
                        {resume.label || resume.originalFileName}
                      </h2>
                      <div className="text-[11px] font-mono text-relay-subtle truncate mt-0.5">
                        {resume.originalFileName}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-relay-border/60 flex items-center justify-between text-[11px] font-mono text-relay-subtle">
                    <span>Uploaded: {new Date(resume.uploadedAt).toLocaleDateString()}</span>
                    {resume.skillsCount !== undefined && (
                      <span>{resume.skillsCount} skills detected</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-relay-border/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reparseMutation.mutate(resume.id);
                      }}
                      disabled={reparseMutation.isPending}
                      className="text-[11px] font-mono text-relay-muted hover:text-relay-text flex items-center gap-1"
                      title="Re-run LLM resume parser"
                    >
                      <RefreshCw className={`w-3 h-3 ${reparseMutation.isPending ? 'animate-spin' : ''}`} />
                      Re-parse
                    </button>
                    <span className="text-relay-border">•</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete resume ${resume.originalFileName}?`)) {
                          deleteMutation.mutate(resume.id);
                        }
                      }}
                      className="text-[11px] font-mono text-relay-muted hover:text-relay-danger flex items-center gap-1"
                      title="Delete resume"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-relay-muted group-hover:text-relay-accent font-mono text-[11px]">
                    View
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-relay-card border border-relay-border rounded-lg w-full max-w-md p-6 shadow-operator-lg">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-relay-text mb-4">
              Upload Candidate Resume
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-relay-muted uppercase mb-1.5">
                  Resume Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Backend / Distributed Systems"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-relay-border bg-relay-bg text-relay-text focus:outline-hidden focus:border-relay-accent font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-relay-muted uppercase mb-1.5">
                  Select PDF File
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs font-mono text-relay-muted file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-mono file:bg-relay-bg file:text-relay-text hover:file:bg-relay-border/50 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-relay-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setSelectedFile(null);
                  }}
                  className="px-3 py-1.5 text-xs font-mono rounded border border-relay-border text-relay-muted hover:text-relay-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading & Parsing...' : 'Upload & Parse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
