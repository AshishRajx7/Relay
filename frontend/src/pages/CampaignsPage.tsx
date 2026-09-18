import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Layers, ArrowRight, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { campaignService } from '../services/campaignService';
import { resumeService } from '../services/resumeService';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';

export const CampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: campaigns, isLoading, refetch } = useQuery({
    queryKey: ['campaigns-list'],
    queryFn: () => campaignService.getAll(),
  });

  const { data: resumes, isLoading: isLoadingResumes } = useQuery({
    queryKey: ['resumes-list'],
    queryFn: () => resumeService.getAll(),
  });

  const usableProfiles = (resumes || []).filter(
    (r) => r.processingStatus === 'READY' && !!r.profile?.id,
  );
  const hasUsableProfiles = usableProfiles.length > 0;

  const createMutation = useMutation({
    mutationFn: (dto: { name: string; candidateProfileId?: string }) =>
      campaignService.create(dto),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      setIsCreateOpen(false);
      setCampaignName('');
      setSelectedResumeId('');
      setErrorMessage(null);
      navigate(`/campaigns/${newCampaign.id}`);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message || err.message || 'Failed to create campaign';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || !hasUsableProfiles) return;
    setErrorMessage(null);
    createMutation.mutate({
      name: campaignName.trim(),
      candidateProfileId: selectedResumeId || undefined,
    });
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#F8FAFC] flex items-center gap-2.5 font-sans">
            <Layers className="w-5 h-5 text-[#C8F25C]" />
            Campaigns
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-sans">
            Autonomous outreach execution pipelines connecting prospect batches to company intelligence and draft synthesis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-xs rounded-md border border-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] bg-[#151922] hover:bg-[#1A2030] transition-colors"
            title="Refresh Campaigns"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (!hasUsableProfiles) return;
              setIsCreateOpen(true);
              setErrorMessage(null);
            }}
            disabled={!hasUsableProfiles}
            title={!hasUsableProfiles ? 'Upload a resume before creating a campaign' : 'Create New Campaign'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md border transition-colors shadow-operator ${
              hasUsableProfiles
                ? 'border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#C8F25C]/90'
                : 'border-white/[0.08] bg-[#151922] text-[#64748B] cursor-not-allowed opacity-60'
            }`}
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* No usable profiles warning banner */}
      {!isLoadingResumes && !hasUsableProfiles && (
        <div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[#F8FAFC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F8FAFC]">No resume profile found.</h3>
              <p className="text-xs text-[#94A3B8] mt-0.5 font-sans">
                Upload a resume before creating a campaign.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/resumes')}
            className="px-3.5 py-1.5 text-xs font-mono font-medium rounded-md border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#C8F25C]/90 transition-colors shrink-0"
          >
            Upload Resume
          </button>
        </div>
      )}

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-[#94A3B8] font-mono text-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
            Loading campaigns...
          </div>
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        !hasUsableProfiles ? (
          <EmptyState
            title="No resume profile found"
            description="Upload a resume before creating a campaign."
            action={{
              label: "Upload Resume",
              onClick: () => navigate('/resumes'),
            }}
          />
        ) : (
          <EmptyState
            title="No campaigns yet"
            description="Create your first campaign to upload prospect contacts, trigger deep research, and draft personalized outreach."
            action={{
              label: "Create First Campaign",
              onClick: () => {
                setIsCreateOpen(true);
                setErrorMessage(null);
              },
            }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
          {campaigns.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/campaigns/${c.id}`)}
              className="p-5 rounded-xl border border-white/[0.08] bg-[#151922] hover:bg-[#1A2030] hover:border-white/[0.16] cursor-pointer transition-all shadow-operator group flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <StatusBadge status={c.status} size="sm" />
                  <span className="text-[11px] font-mono text-[#64748B]">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-[#F8FAFC] group-hover:text-[#C8F25C] transition-colors font-sans">
                  {c.name}
                </h2>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#94A3B8]">
                <span className="font-mono text-[11px]">Open Pipeline Graph</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#C8F25C] transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1115]/80 backdrop-blur-xs p-4">
          <div className="bg-[#151922] border border-white/[0.08] rounded-xl w-full max-w-md p-6 shadow-operator-lg space-y-4">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#F8FAFC]">
              Create New Campaign
            </h3>

            {errorMessage && (
              <div className="p-3 text-xs font-mono rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!hasUsableProfiles && (
              <div className="p-3 text-xs font-mono rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 space-y-2">
                <p>No resume profile found. Upload a resume before creating a campaign.</p>
                <button
                  type="button"
                  onClick={() => navigate('/resumes')}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#C8F25C]/40 bg-[#C8F25C] text-black"
                >
                  Upload Resume
                </button>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#94A3B8] uppercase mb-1.5">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Infrastructure Decision Makers"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-md border border-white/[0.08] bg-[#0F1115] text-[#F8FAFC] focus:outline-hidden focus:border-[#C8F25C] font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#94A3B8] uppercase mb-1.5 flex items-center justify-between">
                  <span>Candidate Resume Profile</span>
                  <span className="text-[10px] text-[#64748B]">Optional</span>
                </label>
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-white/[0.08] bg-[#0F1115] text-[#F8FAFC] focus:outline-hidden focus:border-[#C8F25C] font-mono"
                >
                  <option value="">Auto-select latest active resume</option>
                  {resumes?.map((r) => {
                    const isReady = r.processingStatus === 'READY' && !!r.profile?.id;
                    const statusText =
                      r.processingStatus === 'READY'
                        ? 'Ready'
                        : r.processingStatus === 'FAILED'
                        ? 'Failed'
                        : 'Processing';
                    const displayName = r.label || r.originalFileName;
                    return (
                      <option
                        key={r.id}
                        value={r.profile?.id || ''}
                        disabled={!isReady}
                      >
                        {displayName} — Status: {statusText}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] font-mono text-[#64748B] mt-1">
                  Relay matches evidence from this resume into outreach generation.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded-md border border-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!campaignName.trim() || createMutation.isPending || !hasUsableProfiles}
                  className="px-3.5 py-1.5 text-xs font-mono font-medium rounded-md border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#C8F25C]/90 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
