import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ArrowLeft,
  Globe,
  ExternalLink,
  RefreshCw,
  Cpu,
  Target,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { companyService } from '../services/companyService';
import { StatusBadge } from '../components/common/StatusBadge';
import { ScoreGauge } from '../components/common/ScoreGauge';
import { EmptyState } from '../components/common/EmptyState';

export const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);

  // Fetch Base Company
  const { data: company, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companyService.getById(id!),
    enabled: !!id,
  });

  // Fetch Research Detail
  const {
    data: research,
    isLoading: isResearchLoading,
    refetch: refetchResearch,
  } = useQuery({
    queryKey: ['company-research', id],
    queryFn: () => companyService.getResearch(id!),
    enabled: !!id,
  });

  // Fetch Raw Markdown if toggled
  const { data: rawMarkdownData } = useQuery({
    queryKey: ['company-research-raw', id],
    queryFn: () => companyService.getRawMarkdown(id!),
    enabled: !!id && showRawMarkdown,
  });

  // Trigger / Refresh Research Mutation
  const refreshMutation = useMutation({
    mutationFn: () => {
      if (research?.id) {
        return companyService.refreshResearch(research.id);
      }
      return companyService.triggerResearch(id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-research', id] });
      queryClient.invalidateQueries({ queryKey: ['companies-list'] });
    },
  });

  if (isCompanyLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
        Loading company intelligence...
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-relay-muted font-mono text-xs">Company not found.</p>
        <button
          onClick={() => navigate('/companies')}
          className="px-3 py-1.5 text-xs font-mono rounded border border-relay-border text-relay-text hover:bg-relay-card"
        >
          Return to Companies
        </button>
      </div>
    );
  }

  const hooks = research?.outreachHooks;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/companies')}
        className="flex items-center gap-1.5 text-xs font-mono text-relay-muted hover:text-relay-text transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Target Companies</span>
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono tracking-tight text-relay-text flex items-center gap-2">
              <Building2 className="w-5 h-5 text-relay-accent" />
              {company.name}
            </h1>
            <StatusBadge status={research?.status || 'PENDING'} size="sm" />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-relay-muted">
            <a
              href={company.website?.startsWith('http') ? company.website : `https://${company.normalizedDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-relay-accent hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{company.normalizedDomain}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>

            {research?.industry && (
              <span className="px-2 py-0.5 rounded border border-relay-border bg-relay-bg text-relay-text">
                {research.industry}
              </span>
            )}

            {research?.companySize && (
              <span className="flex items-center gap-1 text-relay-subtle">
                <Users className="w-3.5 h-3.5" />
                <span>{research.companySize}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-relay-border bg-relay-bg text-relay-text hover:bg-relay-card-hover disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{research ? 'Refresh Research' : 'Trigger Research'}</span>
          </button>
        </div>
      </div>

      {!research && !isResearchLoading ? (
        <EmptyState
          title="No research available yet"
          description="Click 'Trigger Research' to crawl company web pages, analyze tech stacks, detect open engineering positions, and generate outreach hooks."
          action={{
            label: "Trigger Deep Research",
            onClick: () => refreshMutation.mutate(),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Cols: Overview, Outreach Hooks, Tech */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Card */}
            <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-relay-muted font-semibold">
                Company Summary & Market Focus
              </span>
              <p className="text-xs text-relay-text leading-relaxed font-sans">
                {research?.summary || company.summary || 'No summary synthesized yet.'}
              </p>
            </div>

            {/* Outreach Hooks Card */}
            <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-relay-border">
                <span className="text-[11px] font-mono uppercase tracking-wider text-relay-muted font-semibold flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-400" />
                  Synthesized Outreach Hooks
                </span>
                <span className="text-[10px] font-mono text-relay-subtle">
                  Used by Outreach V7 Engine
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {hooks?.whyThisCompany ? (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                      Why This Company
                    </span>
                    <div className="p-3 rounded bg-relay-bg border border-relay-border text-relay-text leading-relaxed">
                      {hooks.whyThisCompany}
                    </div>
                  </div>
                ) : null}

                {hooks?.whyNow ? (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                      Why Now (Growth Signals & Timing)
                    </span>
                    <div className="p-3 rounded bg-relay-bg border border-relay-border text-relay-text leading-relaxed">
                      {hooks.whyNow}
                    </div>
                  </div>
                ) : null}

                {hooks?.keyProblemsSolving && hooks.keyProblemsSolving.length > 0 ? (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                      Key Problems Being Solved
                    </span>
                    <ul className="list-disc list-inside space-y-1 p-3 rounded bg-relay-bg border border-relay-border text-relay-muted">
                      {hooks.keyProblemsSolving.map((p, i) => (
                        <li key={i} className="text-relay-text">{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {hooks?.engineeringCultureSignals && hooks.engineeringCultureSignals.length > 0 ? (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">
                      Engineering Culture Signals
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {hooks.engineeringCultureSignals.map((signal, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!hooks?.whyThisCompany && !hooks?.whyNow && (
                  <div className="text-xs text-relay-subtle italic">
                    No explicit outreach hooks generated yet.
                  </div>
                )}
              </div>
            </div>

            {/* Collapsible Raw Markdown Card */}
            <div className="rounded-lg border border-relay-border bg-relay-card shadow-operator overflow-hidden">
              <button
                onClick={() => setShowRawMarkdown(!showRawMarkdown)}
                className="w-full p-4 flex items-center justify-between text-xs font-mono font-medium text-relay-muted hover:text-relay-text hover:bg-relay-card-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-relay-accent" />
                  <span>Inspect Raw Scraped Markdown</span>
                </div>
                {showRawMarkdown ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {showRawMarkdown && (
                <div className="p-4 border-t border-relay-border bg-relay-bg font-mono text-[11px] max-h-96 overflow-y-auto leading-relaxed text-relay-muted whitespace-pre-wrap">
                  {rawMarkdownData?.rawMarkdown || research?.rawMarkdown || (
                    <span className="italic text-relay-subtle">No raw crawled markdown stored for this company.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Tech Stack, Signals, Quality */}
          <div className="space-y-6">
            {/* Research Quality Gauge Card */}
            <div className="p-5 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold">
                Research Depth Score
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xs text-relay-text font-medium">Confidence & Coverage</span>
                <ScoreGauge score={research?.researchQualityScore ?? 0} maxScore={100} size="md" />
              </div>
              {research?.qualityReason && (
                <p className="text-[11px] font-mono text-relay-subtle pt-2 border-t border-relay-border/60">
                  {research.qualityReason}
                </p>
              )}
            </div>

            {/* Tech Stack */}
            <div className="p-5 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-relay-accent" />
                Detected Tech Stack
              </span>

              {research?.techStack && research.techStack.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {research.techStack.map((tech, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-relay-subtle italic">No tech stack signals detected.</span>
              )}
            </div>

            {/* Hiring Signals */}
            <div className="p-5 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold">
                Hiring Signals & Careers
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle font-mono text-[11px]">Hiring Active:</span>
                  {research?.isHiring ? (
                    <span className="text-relay-accent font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-relay-subtle">No signals</span>
                  )}
                </div>

                {research?.atsProvider && (
                  <div className="flex items-center justify-between">
                    <span className="text-relay-subtle font-mono text-[11px]">ATS Provider:</span>
                    <span className="font-mono text-relay-text">{research.atsProvider}</span>
                  </div>
                )}

                {research?.careersPageUrl && (
                  <div className="pt-2 border-t border-relay-border/60">
                    <a
                      href={research.careersPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-relay-accent text-[11px] font-mono hover:underline flex items-center gap-1"
                    >
                      <span>Careers Portal</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
