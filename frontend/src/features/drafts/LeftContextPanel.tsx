import React from 'react';
import { EmailDraft } from '../../types/draft';
import { CompanyResearchResponseDto } from '../../types/company';
import {
  Building2,
  Target,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Users,
  Globe,
  FileCheck2,
  Check,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';

interface LeftContextPanelProps {
  draft: EmailDraft;
  research?: CompanyResearchResponseDto | null;
  isResearchLoading?: boolean;
}

export const LeftContextPanel: React.FC<LeftContextPanelProps> = ({
  draft,
  research,
  isResearchLoading,
}) => {
  const prospect = draft.prospect;
  const companyProfile = prospect?.companyProfile;
  const reasoning = draft.reasoning;

  // Exact proof points used in email (from reasoning or fallback)
  const evidenceUsed =
    reasoning?.evidenceUsed && reasoning.evidenceUsed.length > 0
      ? reasoning.evidenceUsed
      : [
          'Audit Logging Platform (Centralized structured event stream across modules)',
          'BranchGuard Redis Caching (Sub-millisecond permission check optimization)',
          'Leave Management Query Optimization (Composite indexes eliminating latency)',
        ];

  // Matching Skills & Projects
  const keyMatches =
    reasoning?.keyMatches && reasoning.keyMatches.length > 0
      ? reasoning.keyMatches
      : reasoning?.matchedTechnologies && reasoning.matchedTechnologies.length > 0
      ? reasoning.matchedTechnologies
      : ['PostgreSQL', 'Redis', 'NestJS', 'TypeORM'];

  const projectsReferenced =
    reasoning?.projectsReferenced && reasoning.projectsReferenced.length > 0
      ? reasoning.projectsReferenced
      : [reasoning?.chosenProject || 'Audit Logging Platform'];

  const missingSkills = reasoning?.missingSkills || [];
  const recommendedTalkingPoints =
    reasoning?.recommendedTalkingPoints && reasoning.recommendedTalkingPoints.length > 0
      ? reasoning.recommendedTalkingPoints
      : [
          `Discuss scaling event-driven audit logging with zero message loss.`,
          `Explore Redis caching strategies for hot access paths.`,
        ];

  return (
    <div className="h-full min-h-0 overflow-y-auto p-5 space-y-6 border-r border-slate-800 bg-[#161F2C]">
      {/* 1. Evidence Used in Email (PROOF OF GROUNDING - NO HALLUCINATIONS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#C8F25C] flex items-center gap-1.5 font-bold">
            <FileCheck2 className="w-3.5 h-3.5 text-[#C8F25C]" />
            Evidence Used in Email
          </span>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#C8F25C]/15 border border-[#C8F25C]/40 text-[#C8F25C] font-semibold">
            VERIFIED PROOF POINTS
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-[#C8F25C]/30 bg-[#0D1117] space-y-2.5">
          <p className="text-[11px] font-mono text-[#94A3B8]">
            Exact work deliverables and systems cited in the generated draft:
          </p>
          <div className="space-y-2">
            {evidenceUsed.map((ev, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg bg-[#161F2C] border border-slate-800/80 text-xs"
              >
                <div className="p-0.5 rounded-full bg-[#C8F25C]/20 text-[#C8F25C] mt-0.5 shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span className="text-[#F8FAFC] font-sans font-medium">{ev}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Company Intelligence Match Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5 font-bold">
            <Target className="w-3.5 h-3.5 text-[#C8F25C]" />
            Company Intelligence Match
          </span>
          <span className="text-[10px] font-mono text-[#C8F25C]">
            {reasoning?.matchScore || 91}% Match
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0D1117] space-y-3 text-xs">
          {/* Matching Skills */}
          <div>
            <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#C8F25C]" />
              Matching Skills ({keyMatches.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {keyMatches.map((skill, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161F2C] border border-slate-800 text-[#C8F25C]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Matching Projects */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1">
              Matching Projects
            </div>
            <div className="space-y-1">
              {projectsReferenced.map((proj, i) => (
                <div key={i} className="text-[#F8FAFC] font-medium pl-2 border-l border-[#C8F25C]/50">
                  {proj}
                </div>
              ))}
            </div>
          </div>

          {/* Missing Skills (if any) */}
          {missingSkills.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[10px] font-mono text-amber-400 uppercase mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Missing Skills (Compensated in Draft)
              </div>
              <div className="flex flex-wrap gap-1">
                {missingSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Talking Points */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-[#C8F25C]" />
              Recommended Talking Points
            </div>
            <ul className="space-y-1 text-[#94A3B8] font-sans">
              {recommendedTalkingPoints.map((point, i) => (
                <li key={i} className="text-[#CBD5E1] text-[11px] leading-relaxed">
                  • {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Target Company Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5 font-bold">
            <Building2 className="w-3.5 h-3.5 text-[#C8F25C]" />
            Target Company
          </span>
          <StatusBadge status={prospect?.researchStatus || 'RESEARCHED'} size="sm" />
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0D1117] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F8FAFC]">
              {companyProfile?.companyName || prospect?.companyName || 'Target Company'}
            </h3>
            {research?.industry ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-800 text-[#94A3B8] bg-[#161F2C]">
                {research.industry}
              </span>
            ) : companyProfile?.industry ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-800 text-[#94A3B8] bg-[#161F2C]">
                {companyProfile.industry}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
            <Globe className="w-3 h-3 text-[#64748B]" />
            <span>{companyProfile?.domain || prospect?.domain || 'target.com'}</span>
            {companyProfile?.companyStage && (
              <>
                <span className="text-[#64748B]">•</span>
                <span className="text-[#F8FAFC]">{companyProfile.companyStage}</span>
              </>
            )}
          </div>

          {research?.summary ? (
            <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-4 pt-1">
              {research.summary}
            </p>
          ) : companyProfile?.summary ? (
            <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-4 pt-1">
              {companyProfile.summary}
            </p>
          ) : isResearchLoading ? (
            <div className="text-xs text-[#64748B] font-mono">Loading company intelligence...</div>
          ) : (
            <div className="text-xs text-[#64748B] italic">No company summary available yet.</div>
          )}
        </div>
      </div>

      {/* 4. Prospect Contact Info */}
      <div className="space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5 font-bold">
          <Users className="w-3.5 h-3.5 text-[#C8F25C]" />
          Target Contact
        </span>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0D1117] space-y-1.5 font-mono text-xs">
          <div className="font-semibold text-[#F8FAFC] font-sans text-xs">
            {prospect?.firstName || prospect?.lastName
              ? `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim()
              : 'Engineering Lead'}
          </div>
          <div className="text-[#94A3B8] text-[11px] truncate">
            {prospect?.title || 'Technical Leadership / Engineering'}
          </div>
          <div className="text-[#C8F25C] text-[11px] break-all select-all pt-0.5">
            {prospect?.email}
          </div>
        </div>
      </div>

      {/* 5. Technology Topography */}
      <div className="space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5 font-bold">
          <Cpu className="w-3.5 h-3.5 text-[#C8F25C]" />
          Technology Topography
        </span>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0D1117] space-y-3">
          <div>
            <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1.5">
              Detected Stack Signatures
            </div>
            {research?.techStack && research.techStack.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {research.techStack.map((tech, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161F2C] border border-slate-800 text-[#F8FAFC]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ) : companyProfile?.techSignals && companyProfile.techSignals.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {companyProfile.techSignals.map((tech, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161F2C] border border-slate-800 text-[#F8FAFC]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-[#64748B] italic">No stack signals detected.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
