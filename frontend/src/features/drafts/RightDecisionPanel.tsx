import React from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { EmailDraft, EmailVariantType } from '../../types/draft';
import { ScoreGauge } from '../../components/common/ScoreGauge';
import { StatusBadge } from '../../components/common/StatusBadge';

interface RightDecisionPanelProps {
  draft: EmailDraft;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onSelectVariant: (variantType: EmailVariantType) => Promise<void>;
  onCreateGmailDraft: () => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
  isRegenerating: boolean;
  isSelectingVariant: boolean;
  isCreatingGmailDraft: boolean;
}

export const RightDecisionPanel: React.FC<RightDecisionPanelProps> = ({
  draft,
  onApprove,
  onReject,
  onRegenerate,
  onSelectVariant,
  onCreateGmailDraft,
  isApproving,
  isRejecting,
  isRegenerating,
  isSelectingVariant,
  isCreatingGmailDraft,
}) => {
  const quality = draft.quality;
  const reasoning = draft.reasoning;
  const variants = draft.variants || [];

  const isApproved = draft.status === 'APPROVED';
  const isGmailCreated = draft.status === 'GMAIL_DRAFT_CREATED';
  const isRejected = draft.status === 'REJECTED';

  // Quality overall score (average or confidence score)
  const overallScore = quality?.confidenceScore ?? (quality?.personalizationScore ? Math.round((quality.personalizationScore + quality.relevanceScore + quality.technicalAlignmentScore) / 3) : 0);

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6 border-l border-relay-border bg-relay-bg/50 flex flex-col justify-between">
      <div className="space-y-6">
        {/* Header Status */}
        <div className="flex items-center justify-between pb-3 border-b border-relay-border">
          <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold">
            Draft Decision Panel
          </span>
          <StatusBadge status={draft.status} size="sm" />
        </div>

        {/* 1. Quality Scorecard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted flex items-center gap-1.5 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-relay-accent" />
              Quality Scorecard
            </span>
            {quality?.requiresManualReview && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Review Required
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-md border border-relay-border bg-relay-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-relay-text">Overall Quality</span>
              <ScoreGauge score={overallScore} maxScore={100} size="sm" />
            </div>

            {quality ? (
              <div className="space-y-2 pt-2 border-t border-relay-border/60 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle">Personalization:</span>
                  <span className="text-relay-text font-medium">{quality.personalizationScore}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle">Relevance:</span>
                  <span className="text-relay-text font-medium">{quality.relevanceScore}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle">Spam Risk:</span>
                  <span className={`${quality.spamRiskScore > 30 ? 'text-amber-400' : 'text-relay-success'} font-medium`}>
                    {quality.spamRiskScore}/100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle">Tech Alignment:</span>
                  <span className="text-relay-text font-medium">{quality.technicalAlignmentScore}/100</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-relay-subtle italic">Quality evaluation pending.</div>
            )}

            {/* Flags */}
            {quality?.flags && quality.flags.length > 0 && (
              <div className="pt-2 border-t border-relay-border/60 space-y-1">
                <span className="text-[10px] font-mono text-relay-subtle uppercase flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" /> Evaluation Flags
                </span>
                <div className="space-y-1">
                  {quality.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300"
                    >
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Why This Works */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold">
            Why This Works
          </span>
          <div className="p-3 rounded-md border border-relay-border bg-relay-card text-xs text-relay-muted leading-relaxed space-y-2">
            {reasoning?.whyCompany ? (
              <p>
                <strong className="text-relay-text font-mono text-[11px] block mb-0.5">Company Fit:</strong>
                {reasoning.whyCompany}
              </p>
            ) : null}
            {reasoning?.whyMe ? (
              <p>
                <strong className="text-relay-text font-mono text-[11px] block mb-0.5">Candidate Edge:</strong>
                {reasoning.whyMe}
              </p>
            ) : null}
            {!reasoning?.whyCompany && !reasoning?.whyMe && (
              <span className="text-relay-subtle italic">
                Uses short 4-paragraph human engineer voice with single highlighted project and attached PDF resume.
              </span>
            )}
          </div>
        </div>

        {/* 3. Variant Switcher */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold">
            Email Variant Switcher
          </span>

          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-md border border-relay-border bg-relay-card">
            {(['TECHNICAL', 'STARTUP', 'DIRECT'] as EmailVariantType[]).map((vType) => {
              const matchedVariant = variants.find((v) => v.variantType === vType);
              const isSelected = matchedVariant?.isSelected ?? false;

              return (
                <button
                  key={vType}
                  disabled={isSelectingVariant}
                  onClick={() => onSelectVariant(vType)}
                  className={`py-1.5 px-2 text-[10px] font-mono rounded transition-all flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'bg-relay-accent text-black font-semibold shadow-xs'
                      : 'text-relay-muted hover:text-relay-text hover:bg-relay-bg/80'
                  }`}
                >
                  <span>{vType}</span>
                  {matchedVariant?.wordCount && (
                    <span className="text-[9px] opacity-75 font-mono">
                      {matchedVariant.wordCount}w
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="pt-4 border-t border-relay-border space-y-2.5">
        {/* Approve & Reject Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onApprove}
            disabled={isApproving || isApproved || isGmailCreated}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-mono font-medium rounded border transition-all ${
              isApproved || isGmailCreated
                ? 'bg-relay-success/20 border-relay-success/40 text-relay-success cursor-default'
                : 'bg-relay-success/15 border-relay-success/30 text-relay-success hover:bg-relay-success/25'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isApproving ? 'Approving...' : isApproved || isGmailCreated ? 'Approved' : 'Approve'}
          </button>

          <button
            onClick={onReject}
            disabled={isRejecting || isRejected}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-mono font-medium rounded border transition-all ${
              isRejected
                ? 'bg-relay-danger/20 border-relay-danger/40 text-relay-danger cursor-default'
                : 'bg-relay-danger/15 border-relay-danger/30 text-relay-danger hover:bg-relay-danger/25'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            {isRejecting ? 'Rejecting...' : isRejected ? 'Rejected' : 'Reject'}
          </button>
        </div>

        {/* Regenerate Button */}
        <button
          onClick={onRegenerate}
          disabled={isRegenerating || isGmailCreated}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-mono rounded border border-relay-border bg-relay-card text-relay-text hover:bg-relay-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? 'Regenerating AI Draft...' : 'Regenerate Draft'}
        </button>

        {/* Create Gmail Draft Button (Strictly locked until APPROVED) */}
        <div className="space-y-1 pt-1">
          <button
            onClick={onCreateGmailDraft}
            disabled={!isApproved || isCreatingGmailDraft || isGmailCreated}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-mono font-semibold rounded border transition-all ${
              isGmailCreated
                ? 'bg-relay-accent/20 border-relay-accent text-relay-accent cursor-default'
                : isApproved
                ? 'bg-relay-accent border-relay-accent text-black hover:bg-relay-accent-hover shadow-operator'
                : 'bg-relay-card border-relay-border text-relay-muted/50 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {isCreatingGmailDraft
              ? 'Creating Gmail Draft...'
              : isGmailCreated
              ? 'Gmail Draft Created'
              : 'Create Gmail Draft'}
          </button>

          {!isApproved && !isGmailCreated && (
            <p className="text-[10px] font-mono text-relay-subtle text-center">
              Requires human approval before Gmail handoff
            </p>
          )}

          {draft.gmailDraftId && (
            <div className="text-[10px] font-mono text-relay-accent/80 text-center flex items-center justify-center gap-1 pt-1">
              <span>Synced Draft ID: {draft.gmailDraftId}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
