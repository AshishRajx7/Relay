import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ArrowLeft, RefreshCw, ExternalLink } from 'lucide-react';
import { draftService } from '../services/draftService';
import { companyService } from '../services/companyService';
import { LeftContextPanel } from '../features/drafts/LeftContextPanel';
import { CenterEditorPanel } from '../features/drafts/CenterEditorPanel';
import { RightDecisionPanel } from '../features/drafts/RightDecisionPanel';
import { EmailVariantType } from '../types/draft';
import { StatusBadge } from '../components/common/StatusBadge';

export const DraftWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Query Draft
  const {
    data: draft,
    isLoading: isDraftLoading,
    refetch: refetchDraft,
  } = useQuery({
    queryKey: ['draft', id],
    queryFn: () => draftService.getById(id!),
    enabled: !!id,
  });

  // Query Company Research if companyProfile exists
  const companyId = draft?.prospect?.companyProfile?.id;
  const { data: companyResearch, isLoading: isResearchLoading } = useQuery({
    queryKey: ['company-research', companyId],
    queryFn: () => companyService.getResearch(companyId!),
    enabled: !!companyId,
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ subject, body }: { subject: string; body: string }) =>
      draftService.update(id!, { subject, body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const selectVariantMutation = useMutation({
    mutationFn: (variantType: EmailVariantType) =>
      draftService.selectVariant(id!, variantType),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => draftService.approve(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => draftService.reject(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => draftService.regenerate(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const overrideResumeMutation = useMutation({
    mutationFn: (resumeId: string) => draftService.overrideResume(id!, resumeId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const createGmailDraftMutation = useMutation({
    mutationFn: () => draftService.createGmailDraft(id!),
    onSuccess: () => {
      refetchDraft();
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
  });

  // Keyboard Shortcuts (Cmd+Enter to approve, Esc to return to queue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (draft && draft.status !== 'APPROVED' && !approveMutation.isPending) {
          approveMutation.mutate();
        }
      } else if (e.key === 'Escape') {
        navigate('/queue');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draft, approveMutation, navigate]);

  if (isDraftLoading) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-[#94A3B8] font-mono text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-[#94A3B8] font-mono text-xs">Draft not found in review queue.</p>
        <button
          onClick={() => navigate('/queue')}
          className="px-3.5 py-1.5 text-xs font-mono rounded-lg border border-slate-700/60 bg-[#161F2C] text-[#F8FAFC] hover:bg-[#1E293B] transition-colors"
        >
          Return to Review Queue
        </button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0D1117] overflow-hidden font-sans select-none">
      {/* Top Hero Workspace Bar */}
      <div className="h-11 px-5 border-b border-slate-800 bg-[#161F2C] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
            title="Return to Directory"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Companies</span>
          </button>

          <div className="h-3.5 w-px bg-slate-800" />

          {/* Prospect and Company Breadcrumb */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-[#F8FAFC]">
              {draft.prospect?.companyName || 'Target Company'}
            </span>
            <span className="text-[#64748B] text-xs">/</span>
            <span className="font-mono text-xs text-[#94A3B8]">
              {draft.prospect?.firstName || draft.prospect?.email}
            </span>
          </div>

          <StatusBadge status={draft.status} size="sm" />
        </div>

        {/* Right Shortcuts & Telemetry */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 text-[11px] font-mono text-[#64748B]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#0D1117] border border-slate-800 text-[#94A3B8]">⌘↵</kbd> Approve
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#0D1117] border border-slate-800 text-[#94A3B8]">⌘S</kbd> Save
            </span>
          </div>

          {draft.prospect?.campaignId && (
            <button
              onClick={() => navigate(`/campaigns/${draft.prospect.campaignId}`)}
              className="text-[11px] font-mono text-[#94A3B8] hover:text-[#F8FAFC] transition-colors flex items-center gap-1"
            >
              <span>Pipeline</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => refetchDraft()}
            className="p-1.5 text-xs rounded-lg border border-slate-700/60 text-[#94A3B8] hover:text-[#F8FAFC] bg-[#1E293B] transition-colors"
            title="Refresh Draft"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* True Operator 3-Panel Resizable Workspace (Balanced 32% / 38% / 30%) */}
      <div className="flex-1 min-h-0 relative">
        <Group orientation="horizontal" className="h-full">
          {/* Left Panel: Company Intelligence (32%) */}
          <Panel defaultSize={32} minSize={25} maxSize={42}>
            <div className="h-full min-h-0 overflow-hidden">
              <LeftContextPanel
                draft={draft}
                research={companyResearch}
                isResearchLoading={isResearchLoading}
              />
            </div>
          </Panel>

          {/* Resizable Handle */}
          <Separator className="w-1 bg-slate-800 hover:bg-[#C8F25C] transition-colors cursor-col-resize select-none" />

          {/* Center Panel: Email Editor (38%) */}
          <Panel defaultSize={38} minSize={28} maxSize={46}>
            <div className="h-full min-h-0 overflow-hidden relative">
              {/* Soft radial light behind editor */}
              <div
                className="pointer-events-none absolute inset-0 opacity-40 z-0"
                style={{
                  background: 'radial-gradient(circle 500px at 50% 30%, rgba(200, 242, 92, 0.035), transparent 70%)',
                }}
              />
              <div className="relative z-10 h-full min-h-0">
                <CenterEditorPanel
                  draft={draft}
                  onSave={async (subject, body) => {
                    await updateMutation.mutateAsync({ subject, body });
                  }}
                  isSaving={updateMutation.isPending}
                />
              </div>
            </div>
          </Panel>

          {/* Resizable Handle */}
          <Separator className="w-1 bg-slate-800 hover:bg-[#C8F25C] transition-colors cursor-col-resize select-none" />

          {/* Right Panel: Candidate Match Engine (30%) */}
          <Panel defaultSize={30} minSize={25} maxSize={42}>
            <div className="h-full min-h-0 overflow-hidden">
              <RightDecisionPanel
                draft={draft}
                onApprove={async () => {
                  await approveMutation.mutateAsync();
                }}
                onReject={async () => {
                  await rejectMutation.mutateAsync();
                }}
                onRegenerate={async () => {
                  await regenerateMutation.mutateAsync();
                }}
                onSelectVariant={async (variantType) => {
                  await selectVariantMutation.mutateAsync(variantType);
                }}
                onCreateGmailDraft={async () => {
                  await createGmailDraftMutation.mutateAsync();
                }}
                onOverrideResume={async (resumeId) => {
                  await overrideResumeMutation.mutateAsync(resumeId);
                }}
                isApproving={approveMutation.isPending}
                isRejecting={rejectMutation.isPending}
                isRegenerating={regenerateMutation.isPending}
                isSelectingVariant={selectVariantMutation.isPending}
                isCreatingGmailDraft={createGmailDraftMutation.isPending}
                isOverriding={overrideResumeMutation.isPending}
              />
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
};
