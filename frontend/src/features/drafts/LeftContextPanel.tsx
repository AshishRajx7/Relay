import React from 'react';
import { EmailDraft } from '../../types/draft';
import { CompanyResearchResponseDto } from '../../types/company';
import { User, Building2, Sparkles, Target, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
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

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6 border-r border-relay-border bg-relay-bg/50">
      {/* 1. Prospect Context */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted flex items-center gap-1.5 font-semibold">
            <User className="w-3.5 h-3.5 text-relay-accent" />
            Prospect Context
          </span>
          <StatusBadge status={prospect?.researchStatus || 'PENDING'} size="sm" />
        </div>

        <div className="p-3.5 rounded-md border border-relay-border bg-relay-card space-y-2">
          <div className="text-sm font-medium text-relay-text">
            {prospect?.firstName || prospect?.lastName
              ? `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim()
              : 'Unknown Contact'}
          </div>
          {prospect?.title && (
            <div className="text-xs text-relay-muted font-mono">{prospect.title}</div>
          )}
          <div className="text-xs text-relay-muted font-mono break-all select-all">
            {prospect?.email}
          </div>
          {prospect?.domain && (
            <div className="text-[11px] text-relay-subtle font-mono flex items-center gap-1">
              <span>Domain:</span>
              <span className="text-relay-text font-medium">{prospect.domain}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Company Information */}
      <div className="space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted flex items-center gap-1.5 font-semibold">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          Company Information
        </span>

        <div className="p-3.5 rounded-md border border-relay-border bg-relay-card space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-relay-text">
              {companyProfile?.companyName || prospect?.companyName || 'Target Company'}
            </span>
            {research?.industry && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-relay-border text-relay-muted">
                {research.industry}
              </span>
            )}
          </div>

          {research?.summary ? (
            <p className="text-xs text-relay-muted leading-relaxed line-clamp-4">
              {research.summary}
            </p>
          ) : companyProfile?.summary ? (
            <p className="text-xs text-relay-muted leading-relaxed line-clamp-4">
              {companyProfile.summary}
            </p>
          ) : isResearchLoading ? (
            <div className="text-xs text-relay-subtle font-mono">Loading company details...</div>
          ) : (
            <div className="text-xs text-relay-subtle italic">No company summary available yet.</div>
          )}

          {research?.companySize && (
            <div className="text-[11px] font-mono text-relay-subtle flex items-center gap-1.5">
              <span>Size:</span>
              <span className="text-relay-text">{research.companySize}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Research Signals */}
      <div className="space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted flex items-center gap-1.5 font-semibold">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          Research Signals
        </span>

        <div className="p-3.5 rounded-md border border-relay-border bg-relay-card space-y-3">
          {/* Tech Stack */}
          <div>
            <div className="text-[10px] font-mono text-relay-subtle uppercase mb-1.5">Tech Stack</div>
            {research?.techStack && research.techStack.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {research.techStack.map((tech, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text"
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
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-relay-subtle italic">No tech stack signals detected yet.</span>
            )}
          </div>

          {/* Hiring Signals */}
          <div>
            <div className="text-[10px] font-mono text-relay-subtle uppercase mb-1.5">Hiring Status</div>
            {research?.isHiring ? (
              <div className="flex items-center gap-1.5 text-xs text-relay-accent font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Actively Hiring</span>
                {research.atsProvider && (
                  <span className="text-[10px] font-mono text-relay-muted">({research.atsProvider})</span>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-relay-subtle">
                {research ? 'No active engineering roles detected' : 'Research pending'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Outreach Hooks & Reasoning */}
      <div className="space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted flex items-center gap-1.5 font-semibold">
          <Target className="w-3.5 h-3.5 text-amber-400" />
          Outreach Hooks
        </span>

        <div className="p-3.5 rounded-md border border-relay-border bg-relay-card space-y-3 text-xs">
          {research?.outreachHooks?.whyThisCompany ? (
            <div>
              <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                Why This Company
              </span>
              <p className="text-relay-text leading-relaxed bg-relay-bg p-2 rounded border border-relay-border/80">
                {research.outreachHooks.whyThisCompany}
              </p>
            </div>
          ) : null}

          {research?.outreachHooks?.whyNow ? (
            <div>
              <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                Why Now (Timing)
              </span>
              <p className="text-relay-text leading-relaxed bg-relay-bg p-2 rounded border border-relay-border/80">
                {research.outreachHooks.whyNow}
              </p>
            </div>
          ) : null}

          {research?.outreachHooks?.keyProblemsSolving && research.outreachHooks.keyProblemsSolving.length > 0 ? (
            <div>
              <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                Problems They Solve
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-relay-muted">
                {research.outreachHooks.keyProblemsSolving.map((prob, i) => (
                  <li key={i} className="line-clamp-2">{prob}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Reasoning from Generation */}
          {reasoning?.whyRelevant && (
            <div>
              <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                Relevance Thesis
              </span>
              <p className="text-relay-text leading-relaxed bg-relay-bg p-2 rounded border border-relay-border/80">
                {reasoning.whyRelevant}
              </p>
            </div>
          )}

          {reasoning?.chosenProject && (
            <div>
              <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                Candidate Project Highlighted
              </span>
              <span className="font-mono text-relay-accent text-[11px]">
                {reasoning.chosenProject}
              </span>
            </div>
          )}

          {!research?.outreachHooks?.whyThisCompany && !reasoning?.whyRelevant && (
            <div className="text-xs text-relay-subtle italic flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Outreach hooks will populate once deep research completes.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
