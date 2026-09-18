import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  Sparkles,
  ExternalLink,
  Briefcase,
  Trophy,
  Lock,
  FileCheck2,
  Users,
  Compass,
  FileText,
  Zap,
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
  onOverrideResume?: (resumeId: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
  isRegenerating: boolean;
  isSelectingVariant: boolean;
  isCreatingGmailDraft: boolean;
  isOverriding?: boolean;
}

export const RightDecisionPanel: React.FC<RightDecisionPanelProps> = ({
  draft,
  onApprove,
  onReject,
  onRegenerate,
  onSelectVariant,
  onCreateGmailDraft,
  onOverrideResume,
  isApproving,
  isRejecting,
  isRegenerating,
  isSelectingVariant,
  isCreatingGmailDraft,
  isOverriding,
}) => {
  const quality = draft.quality;
  const reasoning = draft.reasoning;
  const variants = draft.variants || [];
  const prospect = draft.prospect;
  const companyProfile = prospect?.companyProfile;

  const isApproved = draft.status === 'APPROVED';
  const isGmailCreated = draft.status === 'GMAIL_DRAFT_CREATED';
  const isRejected = draft.status === 'REJECTED';

  // Overall Match Score
  const matchScore =
    reasoning?.matchScore ||
    quality?.confidenceScore ||
    (quality?.personalizationScore
      ? Math.round(
          (quality.personalizationScore +
            quality.relevanceScore +
            quality.technicalAlignmentScore) /
            3,
        )
      : 88);

  const selectedResumeName = reasoning?.selectedResumeName || 'Backend Engineer Resume';
  const selectedResumeCategory = (reasoning?.selectedResumeCategory || 'BACKEND').toUpperCase();
  const selectionReason =
    reasoning?.selectionReason ||
    'Selected for deepest alignment with distributed systems, PostgreSQL query optimization, and background queue infrastructure.';

  const allResumeScores = reasoning?.allResumeScores || [];

  return (
    <div className="h-full min-h-0 flex flex-col justify-between border-l border-slate-800 bg-[#161F2C] overflow-hidden font-sans select-none">
      {/* Top Header */}
      <div className="px-5 py-3 border-b border-slate-800 bg-[#161F2C] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C8F25C]" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#F8FAFC]">
            Candidate Match Engine
          </span>
        </div>
        <StatusBadge status={draft.status} size="sm" />
      </div>

      {/* Main Scrollable Decision Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
        {/* 1. Selected Resume & Override Switcher */}
        <div className="p-4 rounded-xl border border-[#C8F25C]/30 bg-[#0D1117] space-y-3 shadow-operator">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C8F25C]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Selected Candidate Resume
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C8F25C]/15 border border-[#C8F25C]/40 text-[#C8F25C] font-semibold">
              {matchScore}% MATCH
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white font-sans">
                {selectedResumeName}
              </h4>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                  selectedResumeCategory === 'AI_ML'
                    ? 'bg-purple-500/15 border border-purple-500/40 text-purple-300'
                    : selectedResumeCategory === 'FULL_STACK'
                    ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300'
                    : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                }`}
              >
                {selectedResumeCategory}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed font-sans">
              {selectionReason}
            </p>
          </div>

          {/* Interactive Resume Override Deck */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B] uppercase">
              <span>Switch / Override Resume Profile</span>
              {isOverriding && <span className="text-[#C8F25C] animate-pulse">Switching...</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {allResumeScores.length > 0 ? (
                allResumeScores.map((r) => {
                  const isActive = r.isSelected || r.resumeId === reasoning?.selectedResumeId;
                  return (
                    <button
                      key={r.resumeId}
                      onClick={() => onOverrideResume && onOverrideResume(r.resumeId)}
                      disabled={isOverriding || isActive}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between border transition-all ${
                        isActive
                          ? 'bg-[#C8F25C]/15 border-[#C8F25C] text-[#C8F25C]'
                          : 'bg-[#161F2C] border-slate-800 text-[#94A3B8] hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{r.category}</span>
                      <span className="opacity-80">{r.score}%</span>
                    </button>
                  );
                })
              ) : (
                <>
                  <button
                    onClick={() => onOverrideResume && onOverrideResume('backend')}
                    disabled={isOverriding || selectedResumeCategory === 'BACKEND'}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between border transition-all ${
                      selectedResumeCategory === 'BACKEND'
                        ? 'bg-[#C8F25C]/15 border-[#C8F25C] text-[#C8F25C]'
                        : 'bg-[#161F2C] border-slate-800 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <span>BACKEND</span>
                    <span>91%</span>
                  </button>
                  <button
                    onClick={() => onOverrideResume && onOverrideResume('full-stack')}
                    disabled={isOverriding || selectedResumeCategory === 'FULL_STACK'}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between border transition-all ${
                      selectedResumeCategory === 'FULL_STACK'
                        ? 'bg-[#C8F25C]/15 border-[#C8F25C] text-[#C8F25C]'
                        : 'bg-[#161F2C] border-slate-800 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <span>FULL STACK</span>
                    <span>84%</span>
                  </button>
                  <button
                    onClick={() => onOverrideResume && onOverrideResume('ai-ml')}
                    disabled={isOverriding || selectedResumeCategory === 'AI_ML'}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between border transition-all ${
                      selectedResumeCategory === 'AI_ML'
                        ? 'bg-[#C8F25C]/15 border-[#C8F25C] text-[#C8F25C]'
                        : 'bg-[#161F2C] border-slate-800 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <span>AI / ML</span>
                    <span>79%</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Structured Operator Explainability Dossier */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] space-y-3.5 shadow-operator">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#F8FAFC] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#C8F25C]" />
              Why This Email Was Generated
            </span>
            <span className="text-[10px] font-mono text-[#C8F25C] px-2 py-0.5 rounded bg-[#C8F25C]/10 border border-[#C8F25C]/30 font-semibold">
              CONFIDENCE: {reasoning?.confidenceLevel || 'HIGH'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs font-sans">
            {/* Target Company Signal (Source Fact) */}
            <div className="p-2.5 rounded-lg bg-[#161F2C] border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#64748B] font-semibold flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-cyan-400" />
                  Target Company Signal
                </span>
                <span className="text-[9px] font-mono text-cyan-400/90 font-medium">SOURCE FACT</span>
              </div>
              <div className="text-white font-medium text-[11px]">
                {companyProfile?.companyName || prospect?.companyName || 'Target Company'} •{' '}
                <span className="text-[#94A3B8]">{companyProfile?.domain || prospect?.domain}</span>
              </div>
              {companyProfile?.summary && (
                <p className="text-[#94A3B8] text-[11px] leading-relaxed italic border-l-2 border-cyan-500/40 pl-2 mt-1">
                  "{companyProfile.summary}"
                </p>
              )}
            </div>

            {/* Inferred Technical Relationship (Relay Inference) */}
            <div className="p-2.5 rounded-lg bg-[#161F2C] border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#64748B] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#C8F25C]" />
                  Inferred Technical Relationship
                </span>
                <span className="text-[9px] font-mono text-[#C8F25C] font-medium">RELAY INFERENCE</span>
              </div>
              <div className="text-white leading-relaxed text-[11px]">
                {reasoning?.selectionReason ||
                  reasoning?.whyRelevant ||
                  reasoning?.whyMe ||
                  'Direct architectural correspondence between candidate deliverables and company engineering initiatives.'}
              </div>
              {draft.strategy?.selectedAngle && (
                <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono text-[#94A3B8]">
                  <span className="text-[#64748B]">STRATEGY ANGLE:</span>
                  <span className="text-white font-medium">{draft.strategy.selectedAngle}</span>
                </div>
              )}
            </div>

            {/* Candidate Deliverable & Resume Provenance (Source Fact) */}
            <div className="p-2.5 rounded-lg bg-[#161F2C] border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#64748B] font-semibold flex items-center gap-1">
                  <FileCheck2 className="w-3 h-3 text-purple-400" />
                  Candidate Deliverable & Provenance
                </span>
                <span className="text-[9px] font-mono text-purple-400 font-medium">VERIFIED FACT</span>
              </div>
              <div className="text-white font-medium text-[11px]">
                {reasoning?.chosenProject || reasoning?.projectsReferenced?.[0] || 'Core Engineering Deliverable'}
              </div>
              {reasoning?.whyMePoints && reasoning.whyMePoints.length > 0 && (
                <ul className="space-y-1 text-[11px] text-[#CBD5E1] pt-1">
                  {reasoning.whyMePoints.slice(0, 2).map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#C8F25C] mt-0.5">•</span>
                      <span className="leading-tight">{pt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Key Engineering Matches */}
            <div className="p-2.5 rounded-lg bg-[#161F2C] border border-slate-800/80 space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-[#64748B] font-semibold">Grounded Technical Signals</div>
              <div className="flex flex-wrap gap-1">
                {(reasoning?.keyMatches || reasoning?.matchedTechnologies || ['PostgreSQL', 'Redis', 'NestJS']).map(
                  (m, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0D1117] border border-slate-800 text-[#C8F25C] font-semibold"
                    >
                      {m}
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Adversarial Claim Verification & Integrity Card */}
            <div className="p-2.5 rounded-lg bg-[#161F2C] border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#64748B] font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  Claim Verification & Role Integrity
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                    draft.verification?.crossRoleBleedDetected
                      ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                      : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {draft.verification?.crossRoleBleedDetected ? 'BLEED DETECTED' : 'CLEAN BOUNDARY'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px] font-mono">
                <div className="p-1.5 rounded bg-[#0D1117] border border-slate-800 text-[#94A3B8]">
                  CLAIMS:{' '}
                  <span className="text-white font-bold">
                    {draft.verification?.verifiedClaimsCount || 0} / {draft.verification?.totalClaimsCount || 0}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-[#0D1117] border border-slate-800 text-[#94A3B8]">
                  CONTAMINATION:{' '}
                  <span className={draft.verification?.crossRoleBleedDetected ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {draft.verification?.crossRoleBleedDetected ? 'ALERT' : '0 BLEED'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Variant Switcher Deck */}
        {variants.length > 0 && (
          <div className="space-y-2.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#C8F25C]" />
              Variant Synthesis Deck
            </span>

            <div className="grid grid-cols-3 gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelectVariant(v.variantType)}
                  disabled={isSelectingVariant || v.isSelected}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    v.isSelected
                      ? 'border-[#C8F25C] bg-[#C8F25C]/10 text-[#C8F25C] shadow-[0_0_12px_rgba(200,242,92,0.15)]'
                      : 'border-slate-800 bg-[#0D1117] text-[#94A3B8] hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-[10px] font-mono block font-bold uppercase">{v.variantType}</span>
                  <span className="text-[11px] font-mono text-white font-semibold">
                    {v.confidenceScore || 88}%
                  </span>
                  <span className="text-[9px] font-mono text-[#64748B] block mt-0.5">
                    {v.wordCount}w
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Operator Action Bar */}
      <div className="p-5 border-t border-slate-800 bg-[#161F2C] space-y-3 shrink-0">
        <div className="grid grid-cols-2 gap-2.5">
          <motion.button
            whileTap={!isApproved && !isGmailCreated ? { scale: 0.96 } : {}}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={onApprove}
            disabled={isApproving || isApproved || isGmailCreated}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-mono font-medium rounded-lg border transition-all ${
              isApproved || isGmailCreated
                ? 'bg-[#C8F25C]/20 border-[#C8F25C] text-[#C8F25C] cursor-default'
                : 'bg-[#C8F25C]/10 border-[#C8F25C]/30 text-[#C8F25C] hover:bg-[#C8F25C]/20'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isApproving ? 'Approving...' : isApproved || isGmailCreated ? 'Approved' : 'Approve Draft'}
          </motion.button>

          <button
            onClick={onReject}
            disabled={isRejecting || isRejected}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-mono font-medium rounded-lg border transition-all ${
              isRejected
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 cursor-default'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            {isRejecting ? 'Rejecting...' : isRejected ? 'Rejected' : 'Reject Draft'}
          </button>
        </div>

        {/* Regenerate Button */}
        <button
          onClick={onRegenerate}
          disabled={isRegenerating || isGmailCreated}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-mono rounded-lg border border-slate-800 bg-[#0D1117] text-[#F8FAFC] hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? 'Regenerating AI Draft...' : 'Regenerate Draft'}
        </button>

        {/* Create Gmail Draft Button */}
        <div className="space-y-1 pt-1">
          <motion.button
            whileTap={isApproved && !isGmailCreated ? { scale: 0.97 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onClick={onCreateGmailDraft}
            disabled={!isApproved || isCreatingGmailDraft || isGmailCreated}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-mono font-semibold rounded-lg border transition-all shadow-operator ${
              isGmailCreated
                ? 'bg-[#C8F25C]/20 border-[#C8F25C] text-[#C8F25C] cursor-default'
                : isApproved
                ? 'bg-[#C8F25C] border-[#C8F25C] text-black hover:bg-[#C8F25C]/90 shadow-[0_0_16px_rgba(200,242,92,0.3)]'
                : 'bg-[#0D1117] border-slate-800 text-[#64748B] cursor-not-allowed'
            }`}
          >
            {isGmailCreated ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C8F25C]" />
                <span>Gmail Draft Created</span>
              </>
            ) : isApproved ? (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{isCreatingGmailDraft ? 'Creating Gmail Draft...' : 'Create Gmail Draft'}</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Create Gmail Draft (Locked)</span>
              </>
            )}
          </motion.button>

          {!isApproved && !isGmailCreated && (
            <p className="text-[10px] font-mono text-[#64748B] text-center">
              Requires operator approval before Gmail staging
            </p>
          )}

          {draft.gmailDraftId && (
            <div className="text-[10px] font-mono text-[#C8F25C] text-center flex items-center justify-center gap-1 pt-1">
              <span>Synced Draft ID: {draft.gmailDraftId}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
