import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Mail, ExternalLink } from 'lucide-react';
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
      queryClient.invalidateQueries({ queryKey: ['drafts-list'] });
    },
  });

  const selectVariantMutation = useMutation({
    mutationFn: (variantType: EmailVariantType) =>
      draftService.selectVariant(id!, variantType),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-list'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => draftService.approve(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-list'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => draftService.reject(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-list'] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => draftService.regenerate(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['draft', id], updated);
      queryClient.invalidateQueries({ queryKey: ['drafts-list'] });
    },
  });

  const createGmailDraftMutation = useMutation({
    mutationFn: () => draftService.createGmailDraft(id!),
    onSuccess: () => {
      refetchDraft();
      queryClient.invalidateQueries({ queryKey: ['drafts-list'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
  });

  if (isDraftLoading) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-relay-accent" />
          Loading draft review workspace...
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-relay-muted font-mono text-xs">Draft not found.</p>
        <button
          onClick={() => navigate('/drafts')}
          className="px-3 py-1.5 text-xs font-mono rounded border border-relay-border text-relay-text hover:bg-relay-card"
        >
          Return to Draft Queue
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-relay-bg overflow-hidden">
      {/* Top Workspace Bar */}
      <div className="h-12 px-6 border-b border-relay-border bg-relay-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs font-mono text-relay-muted hover:text-relay-text transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="h-4 w-px bg-relay-border" />

          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-relay-accent" />
            <span className="text-xs font-mono font-semibold text-relay-text">
              {draft.prospect?.companyName || 'Target Company'}
            </span>
            <span className="text-xs text-relay-subtle">/</span>
            <span className="text-xs font-mono text-relay-muted">
              {draft.prospect?.firstName || draft.prospect?.email}
            </span>
          </div>

          <StatusBadge status={draft.status} size="sm" />
        </div>

        <div className="flex items-center gap-3">
          {draft.prospect?.campaignId && (
            <button
              onClick={() => navigate(`/campaigns/${draft.prospect.campaignId}`)}
              className="text-[11px] font-mono text-relay-subtle hover:text-relay-text transition-colors flex items-center gap-1"
            >
              <span>Campaign Mission Control</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => refetchDraft()}
            className="p-1.5 text-xs rounded border border-relay-border text-relay-muted hover:text-relay-text bg-relay-bg transition-colors"
            title="Refresh Draft"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3-Panel Review Workspace */}
      <div className="flex-1 grid grid-cols-12 min-h-0 divide-x divide-relay-border">
        {/* Left Panel: 3.5 cols (Prospect, Company, Signals, Hooks) */}
        <div className="col-span-3 h-full overflow-hidden">
          <LeftContextPanel
            draft={draft}
            research={companyResearch}
            isResearchLoading={isResearchLoading}
          />
        </div>

        {/* Center Panel: 5.5 cols (Draft Editor, Subject, Body, Word Count) */}
        <div className="col-span-6 h-full overflow-hidden">
          <CenterEditorPanel
            draft={draft}
            onSave={async (subject, body) => {
              await updateMutation.mutateAsync({ subject, body });
            }}
            isSaving={updateMutation.isPending}
          />
        </div>

        {/* Right Panel: 3 cols (Quality Score, Why This Works, Variant Switcher, Actions) */}
        <div className="col-span-3 h-full overflow-hidden">
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
            isApproving={approveMutation.isPending}
            isRejecting={rejectMutation.isPending}
            isRegenerating={regenerateMutation.isPending}
            isSelectingVariant={selectVariantMutation.isPending}
            isCreatingGmailDraft={createGmailDraftMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
};
