import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  RotateCcw,
  Upload,
  ArrowLeft,
  Mail,
  FileText,
  AlertTriangle,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { campaignService } from '../services/campaignService';
import { draftService } from '../services/draftService';
import { StatusBadge } from '../components/common/StatusBadge';
import { CampaignPipelineStages } from '../features/campaigns/CampaignPipelineStages';
import { UploadProspectsModal } from '../features/campaigns/UploadProspectsModal';
import { EmptyState } from '../components/common/EmptyState';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!id) return <div>Missing Campaign ID</div>;

  // 1. Fetch Campaign Details
  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignService.getById(id),
  });

  // 2. Fetch Campaign Overview (Progress, Counts, Cost, Duplicates)
  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['campaign-overview', id],
    queryFn: () => campaignService.getOverview(id),
    refetchInterval: 10000,
  });

  // 3. Fetch Drafts in this campaign
  const { data: drafts, isLoading: loadingDrafts, refetch: refetchDrafts } = useQuery({
    queryKey: ['campaign-drafts', id],
    queryFn: () => draftService.getByCampaign(id),
  });

  // Start campaign mutation
  const startMutation = useMutation({
    mutationFn: () => campaignService.start(id),
    onSuccess: (res) => {
      setActionMessage(res.message || 'Campaign processing started.');
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-overview', id] });
    },
  });

  // Retry failed mutation
  const retryMutation = useMutation({
    mutationFn: () => campaignService.retryFailed(id),
    onSuccess: (res) => {
      setActionMessage(`Retried ${res.retriedCount} failed prospects.`);
      queryClient.invalidateQueries({ queryKey: ['campaign-overview', id] });
    },
  });

  // Batch create Gmail drafts mutation
  const batchGmailMutation = useMutation({
    mutationFn: () => draftService.batchCreateGmailDrafts(id),
    onSuccess: (res) => {
      setActionMessage(`Queued ${res.draftsQueued} drafts for Gmail creation.`);
      queryClient.invalidateQueries({ queryKey: ['campaign-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-drafts', id] });
    },
  });

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center p-16 font-mono text-xs text-relay-muted">
        Loading campaign mission control...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8">
        <EmptyState title="Campaign Not Found" description="The requested campaign does not exist." />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-relay-muted">
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center gap-1 hover:text-relay-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Campaigns
        </button>
        <span>/</span>
        <span className="text-relay-text truncate">{campaign.name}</span>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="p-3 rounded bg-relay-accent-muted border border-relay-accent/30 text-xs font-mono text-relay-accent flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-relay-muted hover:text-relay-text">
            ✕
          </button>
        </div>
      )}

      {/* Mission Control Header */}
      <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-mono font-bold text-relay-text">
              {campaign.name}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-relay-muted font-mono">
            <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>Prospects: {overview?.totalProspects ?? 0}</span>
            <span>•</span>
            <span className="text-relay-accent">
              Progress: {overview?.progressPercentage ?? 0}%
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-relay-border bg-relay-bg hover:bg-relay-card-hover text-relay-text transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-relay-muted" />
            Upload Prospects
          </button>

          {overview?.failedCount && overview.failedCount > 0 ? (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-relay-warning/40 bg-relay-warning-muted text-relay-warning hover:bg-relay-warning hover:text-black transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Failed ({overview.failedCount})
            </button>
          ) : null}

          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Campaign
          </button>
        </div>
      </div>

      {/* Visual Pipeline Progress */}
      <CampaignPipelineStages overview={overview} />

      {/* Duplicate & Cost Analysis (if data available) */}
      {overview?.duplicateAnalysis?.warnings && overview.duplicateAnalysis.warnings.length > 0 && (
        <div className="p-4 rounded-lg border border-relay-warning/30 bg-relay-warning-muted/40 text-xs">
          <div className="flex items-center gap-2 font-mono font-semibold text-relay-warning mb-1">
            <AlertTriangle className="w-4 h-4" />
            Duplicate Company Warnings Detected
          </div>
          <ul className="list-disc list-inside space-y-1 text-relay-muted font-mono text-[11px] mt-2">
            {overview.duplicateAnalysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Two-Column Section: Prospects & Drafts (Left) + Activity & Telemetry (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Prospects Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-relay-text flex items-center gap-2">
              <FileText className="w-4 h-4 text-relay-accent" />
              Campaign Outreach Queue ({drafts?.length || 0})
            </h3>
            {drafts && drafts.some((d) => d.status === 'APPROVED' && !d.gmailDraftId) && (
              <button
                onClick={() => batchGmailMutation.mutate()}
                disabled={batchGmailMutation.isPending}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border border-relay-border bg-relay-card hover:bg-relay-card-hover text-relay-accent transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Push Approved to Gmail
              </button>
            )}
          </div>

          {loadingDrafts ? (
            <div className="p-8 text-center font-mono text-xs text-relay-muted">
              Loading campaign drafts...
            </div>
          ) : !drafts || drafts.length === 0 ? (
            <EmptyState
              title="No drafts generated yet"
              description="Upload prospects or click 'Start Campaign' to trigger company research and personalized draft generation."
            />
          ) : (
            <div className="border border-relay-border rounded-lg bg-relay-card overflow-hidden shadow-operator">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-relay-border bg-relay-bg/50 font-mono text-relay-muted text-[11px] uppercase">
                    <th className="py-3 px-4">Prospect</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Quality</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-relay-border font-sans">
                  {drafts.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => navigate(`/drafts/${d.id}`)}
                      className="hover:bg-relay-card-hover cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-relay-text">
                          {d.prospect?.firstName && d.prospect?.lastName
                            ? `${d.prospect.firstName} ${d.prospect.lastName}`
                            : d.prospect?.email}
                        </div>
                        <div className="text-[11px] text-relay-muted font-mono truncate max-w-[180px]">
                          {d.prospect?.email}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-relay-text font-medium">
                          {d.prospect?.companyProfile?.companyName || d.prospect?.companyName || d.prospect?.domain || '—'}
                        </div>
                        <div className="text-[11px] text-relay-subtle font-mono truncate">
                          {d.prospect?.domain || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {d.quality?.confidenceScore ? (
                          <span className={d.quality.confidenceScore >= 70 ? 'text-relay-accent' : 'text-relay-warning'}>
                            {d.quality.confidenceScore}%
                          </span>
                        ) : (
                          <span className="text-relay-subtle">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={d.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-relay-muted hover:text-relay-accent text-xs font-mono inline-flex items-center gap-1">
                          Review <ChevronRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Activity Panel & Telemetry */}
        <div className="space-y-4">
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-relay-text flex items-center gap-2">
            <Clock className="w-4 h-4 text-relay-accent" />
            Campaign Activity Feed
          </h3>

          <div className="bg-relay-card border border-relay-border rounded-lg p-4 space-y-3">
            {/* Honest Placeholder for real-time activity stream */}
            <div className="text-xs text-relay-muted border-b border-relay-border/60 pb-3">
              <span className="font-mono text-relay-text block mb-1">Activity Stream</span>
              <span className="text-[11px] text-relay-subtle">
                Stage progress is live. Real-time event log will stream from BullMQ audit logs.
              </span>
            </div>

            <div className="space-y-2.5 font-mono text-[11px]">
              {overview?.totalProspects && overview.totalProspects > 0 ? (
                <div className="flex items-start gap-2 text-relay-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-relay-accent mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-relay-text font-semibold">{overview.totalProspects} prospects</span> imported into pipeline
                  </div>
                </div>
              ) : null}

              {overview?.researchedProspects && overview.researchedProspects > 0 ? (
                <div className="flex items-start gap-2 text-relay-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-relay-success mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-relay-text font-semibold">{overview.researchedProspects} companies</span> researched via AI
                  </div>
                </div>
              ) : null}

              {overview?.draftsGenerated && overview.draftsGenerated > 0 ? (
                <div className="flex items-start gap-2 text-relay-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-relay-accent mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-relay-text font-semibold">{overview.draftsGenerated} drafts</span> generated & scored
                  </div>
                </div>
              ) : null}

              {overview?.gmailDraftCount && overview.gmailDraftCount > 0 ? (
                <div className="flex items-start gap-2 text-relay-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-relay-success mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-relay-text font-semibold">{overview.gmailDraftCount} drafts</span> synced to Gmail with resume
                  </div>
                </div>
              ) : null}
            </div>

            {/* Telemetry Cost details */}
            {overview?.cost && (
              <div className="pt-3 mt-3 border-t border-relay-border/60 text-[11px] font-mono text-relay-subtle space-y-1">
                <div className="flex justify-between">
                  <span>Crawl operations:</span>
                  <span className="text-relay-text">{overview.cost.crawlCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>LLM invocations:</span>
                  <span className="text-relay-text">{overview.cost.llmCalls}</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Cloud cost:</span>
                  <span className="text-relay-accent">${overview.cost.estimatedCostUsd.toFixed(3)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadProspectsModal
        campaignId={id}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          refetchOverview();
          refetchDrafts();
        }}
      />
    </div>
  );
};
