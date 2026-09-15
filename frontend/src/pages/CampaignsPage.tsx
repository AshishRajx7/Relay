import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Layers, ArrowRight, RefreshCw } from 'lucide-react';
import { campaignService } from '../services/campaignService';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';

export const CampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');

  const { data: campaigns, isLoading, refetch } = useQuery({
    queryKey: ['campaigns-list'],
    queryFn: () => campaignService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => campaignService.create({ name }),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      setIsCreateOpen(false);
      setCampaignName('');
      navigate(`/campaigns/${newCampaign.id}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) return;
    createMutation.mutate(campaignName.trim());
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-relay-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-relay-text flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-relay-accent" />
            Campaigns
          </h1>
          <p className="text-xs text-relay-muted mt-1">
            Outreach operating campaigns linked to company targets and candidate resumes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-xs rounded border border-relay-border text-relay-muted hover:text-relay-text bg-relay-card transition-colors"
            title="Refresh Campaigns"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
          Loading campaigns...
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to upload prospect contacts, trigger deep research, and draft personalized outreach."
          action={{
            label: "Create First Campaign",
            onClick: () => setIsCreateOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/campaigns/${c.id}`)}
              className="p-5 rounded-lg border border-relay-border bg-relay-card hover:border-relay-border-light hover:bg-relay-card-hover cursor-pointer transition-all shadow-operator group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <StatusBadge status={c.status} size="sm" />
                  <span className="text-[11px] font-mono text-relay-subtle">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-base font-medium text-relay-text group-hover:text-relay-accent transition-colors">
                  {c.name}
                </h2>
              </div>

              <div className="pt-4 mt-4 border-t border-relay-border/60 flex items-center justify-between text-xs text-relay-muted">
                <span className="font-mono text-[11px]">Open Mission Control</span>
                <ArrowRight className="w-3.5 h-3.5 text-relay-muted group-hover:text-relay-accent transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-relay-card border border-relay-border rounded-lg w-full max-w-md p-6 shadow-operator-lg">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-relay-text mb-4">
              Create New Campaign
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-relay-muted uppercase mb-1.5">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Backend Infrastructure Outreach"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-relay-border bg-relay-bg text-relay-text focus:outline-hidden focus:border-relay-accent font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-relay-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded border border-relay-border text-relay-muted hover:text-relay-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!campaignName.trim() || createMutation.isPending}
                  className="px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover disabled:opacity-50"
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
