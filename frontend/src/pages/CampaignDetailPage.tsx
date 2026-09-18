import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  RotateCcw,
  Upload,
  ArrowLeft,
  AlertTriangle,
  Clock,
  GitPullRequest,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Send,
  Building2,
  FileText,
  Search,
} from 'lucide-react';
import { campaignService } from '../services/campaignService';
import { draftService } from '../services/draftService';
import { StatusBadge } from '../components/common/StatusBadge';
import { BuildPipeline } from '../components/pipeline/BuildPipeline';
import { UploadProspectsModal } from '../features/campaigns/UploadProspectsModal';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!id) return <div>Missing Pipeline ID</div>;

  // 1. Fetch Campaign Details
  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignService.getById(id),
  });

  // 2. Fetch Campaign Overview (Progress, Counts, Cost, Duplicates)
  const { data: overview } = useQuery({
    queryKey: ['campaign-overview', id],
    queryFn: () => campaignService.getOverview(id),
    refetchInterval: 5000,
  });

  // 3. Fetch Drafts in this campaign
  const { data: drafts, isLoading: loadingDrafts } = useQuery({
    queryKey: ['campaign-drafts', id],
    queryFn: () => draftService.getByCampaign(id),
  });

  // Start campaign mutation
  const startMutation = useMutation({
    mutationFn: () => campaignService.start(id),
    onSuccess: (res) => {
      setActionMessage(res.message || 'Pipeline processing initiated.');
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-overview', id] });
    },
  });

  // Retry failed mutation
  const retryMutation = useMutation({
    mutationFn: () => campaignService.retryFailed(id),
    onSuccess: (res) => {
      setActionMessage(`Retrying ${res.retriedCount} failed jobs.`);
      queryClient.invalidateQueries({ queryKey: ['campaign-overview', id] });
    },
  });

  if (loadingCampaign) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-xs font-mono text-[#94A3B8]">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
          Loading pipeline telemetry...
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-[#94A3B8] font-mono text-xs">Pipeline not found.</p>
        <button
          onClick={() => navigate('/campaigns')}
          className="px-3.5 py-1.5 text-xs font-mono rounded-md border border-white/[0.08] bg-[#151922] text-[#F8FAFC] hover:bg-[#1A2030] transition-colors"
        >
          Return to Pipelines
        </button>
      </div>
    );
  }

  const totalProspects = overview?.totalProspects ?? 0;
  const researchedCount = overview?.researchedProspects ?? 0;
  const draftCount = drafts?.length ?? 0;
  const approvedCount = drafts?.filter((d) => d.status === 'APPROVED' || d.status === 'GMAIL_DRAFT_CREATED').length ?? 0;
  const gmailDraftCount = overview?.gmailDraftCount ?? 0;

  // Guided 5-Step Workflow Statuses
  const steps = [
    {
      step: 1,
      title: 'Campaign Created',
      description: campaign.name,
      status: 'COMPLETED',
      icon: GitPullRequest,
    },
    {
      step: 2,
      title: 'Upload Companies',
      description: totalProspects > 0 ? `${totalProspects} prospects loaded` : 'Upload prospect CSV',
      status: totalProspects > 0 ? 'COMPLETED' : 'ACTIVE',
      icon: Building2,
      action: totalProspects === 0 ? () => setIsUploadOpen(true) : undefined,
      actionLabel: 'Upload CSV',
    },
    {
      step: 3,
      title: 'Research Companies',
      description:
        totalProspects === 0
          ? 'Pending upload'
          : researchedCount >= totalProspects
          ? `${researchedCount}/${totalProspects} researched`
          : `${researchedCount}/${totalProspects} researching`,
      status:
        totalProspects === 0
          ? 'PENDING'
          : researchedCount >= totalProspects && totalProspects > 0
          ? 'COMPLETED'
          : 'ACTIVE',
      icon: Search,
    },
    {
      step: 4,
      title: 'Generate Drafts',
      description:
        totalProspects === 0
          ? 'Pending research'
          : draftCount > 0
          ? `${draftCount} drafts synthesized`
          : 'Synthesizing drafts',
      status:
        draftCount > 0
          ? 'COMPLETED'
          : totalProspects > 0 && researchedCount > 0
          ? 'ACTIVE'
          : 'PENDING',
      icon: FileText,
    },
    {
      step: 5,
      title: 'Review & Send',
      description:
        gmailDraftCount > 0
          ? `${gmailDraftCount} synced to Gmail`
          : approvedCount > 0
          ? `${approvedCount} drafts approved`
          : draftCount > 0
          ? 'Ready for operator review'
          : 'Pending generation',
      status:
        gmailDraftCount > 0
          ? 'COMPLETED'
          : draftCount > 0
          ? 'ACTIVE'
          : 'PENDING',
      icon: Send,
      action: draftCount > 0 ? () => navigate('/queue') : undefined,
      actionLabel: 'Open Review Queue',
    },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/campaigns')}
        className="self-start flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Pipelines</span>
      </button>

      {/* Action notification banner */}
      {actionMessage && (
        <div className="p-3 text-xs font-mono rounded-lg border border-[#C8F25C]/40 bg-[#C8F25C]/10 text-[#C8F25C] flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-[#94A3B8] hover:text-[#F8FAFC]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Guided 5-Step Workflow Tracker */}
      <div className="p-5 rounded-xl border border-white/[0.08] bg-[#151922] shadow-operator space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#F8FAFC] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C8F25C]" />
            Guided Outreach Workflow
          </span>
          <span className="text-[11px] font-mono text-[#C8F25C]">
            5-Step Autonomous Pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = s.status === 'COMPLETED';
            const isActive = s.status === 'ACTIVE';

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                  isCompleted
                    ? 'border-[#C8F25C]/30 bg-[#C8F25C]/5 text-white'
                    : isActive
                    ? 'border-[#C8F25C] bg-[#1A2030] text-white shadow-[0_0_12px_rgba(200,242,92,0.15)]'
                    : 'border-white/[0.06] bg-[#0F1115] text-[#64748B]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold">
                    STEP {s.step}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#C8F25C]" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#C8F25C]' : 'text-[#64748B]'}`} />
                  )}
                </div>

                <div>
                  <h4 className={`text-xs font-semibold font-sans ${isActive ? 'text-[#C8F25C]' : isCompleted ? 'text-[#F8FAFC]' : 'text-[#94A3B8]'}`}>
                    {s.title}
                  </h4>
                  <p className="text-[11px] font-mono text-[#94A3B8] mt-0.5 truncate">
                    {s.description}
                  </p>
                </div>

                {s.action && (
                  <button
                    onClick={s.action}
                    className="w-full mt-1 py-1 px-2 text-[10px] font-mono font-semibold rounded bg-[#C8F25C] text-black hover:bg-[#B8E24C] transition-colors"
                  >
                    {s.actionLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CI/CD Pipeline Header */}
      <div className="p-6 rounded-xl border border-white/[0.08] bg-[#151922] shadow-operator flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-lg font-bold text-[#F8FAFC] font-sans flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-[#C8F25C]" />
              {campaign.name}
            </h1>
            <StatusBadge status={campaign.status} size="sm" />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#94A3B8] font-mono">
            <span>RUN: #{campaign.id.slice(0, 8)}</span>
            <span>•</span>
            <span>{totalProspects} jobs</span>
            <span>•</span>
            <span className="text-[#C8F25C] font-semibold">
              {overview?.progressPercentage ?? 0}% completed
            </span>
            {overview?.cost?.estimatedCostUsd !== undefined && (
              <>
                <span>•</span>
                <span className="text-[#94A3B8] flex items-center gap-0.5">
                  <DollarSign className="w-3 h-3 text-[#C8F25C]" />
                  {overview.cost.estimatedCostUsd.toFixed(4)} USD ({overview.cost.llmCalls} LLM calls)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Pipeline Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-md border border-white/[0.08] bg-[#0F1115] hover:bg-[#1A2030] text-[#F8FAFC] transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#94A3B8]" />
            Ingest Prospects
          </button>

          {overview?.failedCount && overview.failedCount > 0 ? (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Failed Jobs ({overview.failedCount})
            </button>
          ) : null}

          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-medium rounded-md border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#C8F25C]/90 transition-colors disabled:opacity-50 shadow-operator"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Trigger Pipeline
          </button>
        </div>
      </div>

      {/* CI/CD Build Pipeline Graph (Magic UI Animated Beam) */}
      <BuildPipeline overview={overview} status={campaign.status} />

      {/* Duplicate Warnings (if any) */}
      {overview?.duplicateAnalysis?.warnings && overview.duplicateAnalysis.warnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs">
          <div className="flex items-center gap-2 font-mono font-semibold text-amber-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            Duplicate Company Warning
          </div>
          <ul className="list-disc list-inside space-y-1 text-[#94A3B8] font-mono">
            {overview.duplicateAnalysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pipeline Jobs Execution Queue */}
      <div className="space-y-3 pb-8">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[#F8FAFC] font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C8F25C]" />
            Pipeline Jobs ({drafts?.length || 0})
          </span>
          <span className="text-[11px] font-mono text-[#64748B]">
            Select any job to open the 3-panel review workspace
          </span>
        </div>

        {loadingDrafts ? (
          <div className="p-8 text-center text-xs font-mono text-[#94A3B8]">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
              Loading pipeline jobs...
            </div>
          </div>
        ) : !drafts || drafts.length === 0 ? (
          <div className="p-8 rounded-xl border border-white/[0.08] bg-[#151922] text-center text-xs font-mono text-[#94A3B8]">
            No outreach drafts generated yet. Ingest prospects and trigger the pipeline.
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-[#151922] overflow-hidden shadow-operator">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] bg-[#0F1115]/80 font-mono text-[11px] text-[#94A3B8] uppercase">
                <tr>
                  <th className="py-3 px-4">Prospect</th>
                  <th className="py-3 px-4">Target Company</th>
                  <th className="py-3 px-4">Subject Line</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {drafts.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => navigate(`/drafts/${d.id}`)}
                    className="hover:bg-[#1A2030] cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono text-[#F8FAFC]">
                      {d.prospect?.email}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#94A3B8]">
                      {d.prospect?.companyName || '—'}
                    </td>
                    <td className="py-3 px-4 text-[#94A3B8] truncate max-w-xs font-sans">
                      {d.subject}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[#C8F25C] font-semibold">
                      {d.quality?.confidenceScore || 85}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={d.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/drafts/${d.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded-md border border-white/[0.08] bg-[#0F1115] text-[#F8FAFC] group-hover:border-[#C8F25C] group-hover:text-[#C8F25C] transition-colors"
                      >
                        Workspace
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <UploadProspectsModal
          campaignId={id}
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            setIsUploadOpen(false);
            queryClient.invalidateQueries({ queryKey: ['campaign-overview', id] });
            queryClient.invalidateQueries({ queryKey: ['campaign-drafts', id] });
          }}
        />
      )}
    </div>
  );
};
