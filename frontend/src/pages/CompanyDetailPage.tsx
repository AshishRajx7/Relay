import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  ArrowLeft,
  Globe,
  ExternalLink,
  RefreshCw,
  Cpu,
  Target,
  Terminal,
  ChevronDown,
  ChevronRight,
  Shield,
  Zap,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { companyService } from '../services/companyService';
import { draftService } from '../services/draftService';
import { StatusBadge } from '../components/common/StatusBadge';
import { ScoreGauge } from '../components/common/ScoreGauge';
import { EmptyState } from '../components/common/EmptyState';
import { BentoGrid, BentoGridItem } from '../components/ui/bento-grid';

export const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTerminal, setShowTerminal] = useState(false);
  const [copiedTerminal, setCopiedTerminal] = useState(false);

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
  } = useQuery({
    queryKey: ['company-research', id],
    queryFn: () => companyService.getResearch(id!),
    enabled: !!id,
  });

  // Fetch Raw Markdown
  const { data: rawMarkdownData } = useQuery({
    queryKey: ['company-research-raw', id],
    queryFn: () => companyService.getRawMarkdown(id!),
    enabled: !!id && showTerminal,
  });

  // Fetch Drafts to connect Company -> Draft Review Workspace
  const { data: drafts } = useQuery({
    queryKey: ['drafts-all'],
    queryFn: () => draftService.getAll(),
  });

  // Find draft associated with this company
  const matchingDraft = (drafts || []).find(
    (d) =>
      d.prospect?.companyProfile?.id === id ||
      (d.prospect?.companyName && company?.name && d.prospect.companyName.toLowerCase() === company.name.toLowerCase()) ||
      (d.prospect?.domain && company?.normalizedDomain && d.prospect.domain.toLowerCase() === company.normalizedDomain.toLowerCase())
  );

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

  const handleCopyTerminal = () => {
    const text = rawMarkdownData?.rawMarkdown || research?.rawMarkdown || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTerminal(true);
    setTimeout(() => setCopiedTerminal(false), 2000);
  };

  const handleOpenDraftWorkspace = () => {
    if (matchingDraft) {
      navigate(`/drafts/${matchingDraft.id}`);
    } else if (drafts && drafts.length > 0) {
      // Navigate to top active draft in queue
      navigate(`/drafts/${drafts[0].id}`);
    } else {
      navigate('/queue');
    }
  };

  if (isCompanyLoading) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-xs font-mono text-[#94A3B8]">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
          Loading company intelligence dossier...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-[#94A3B8] font-mono text-xs">Target company not found.</p>
        <button
          onClick={() => navigate('/')}
          className="px-3.5 py-1.5 text-xs font-mono rounded-lg border border-slate-700/60 bg-[#161F2C] text-[#F8FAFC] hover:bg-[#1E293B] transition-colors"
        >
          Return to Companies
        </button>
      </div>
    );
  }

  const hooks = research?.outreachHooks;
  const qualityScore = research?.researchQualityScore ?? (company?.researchScore || 90);
  const rawStreamContent = rawMarkdownData?.rawMarkdown || research?.rawMarkdown;

  return (
    <div className="h-full min-h-0 overflow-y-auto flex flex-col p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Navigation Breadcrumb */}
      <button
        onClick={() => navigate('/')}
        className="self-start flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Companies</span>
      </button>

      {/* Dossier Header Card with PROMINENT "Create Outreach" CTA */}
      <div className="p-6 rounded-xl border border-slate-800/80 bg-[#161F2C] shadow-operator flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#1E293B] border border-slate-700/60 text-[#C8F25C]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-[#F8FAFC] tracking-tight font-sans">
                  {company.name}
                </h1>
                <StatusBadge status={research?.status || 'RESEARCHED'} size="sm" />
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-[#94A3B8] pt-1">
                <a
                  href={
                    company.website?.startsWith('http')
                      ? company.website
                      : `https://${company.normalizedDomain}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#C8F25C] hover:underline"
                >
                  <Globe className="w-3 h-3" />
                  <span>{company.normalizedDomain}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span>•</span>
                <span>ID: {company.id.slice(0, 8)}</span>
                {research?.industry && (
                  <>
                    <span>•</span>
                    <span className="text-[#F8FAFC]">{research.industry}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Operator Actions & Prominent "Create Outreach" CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-lg bg-[#0D1117] border border-slate-800 font-mono">
            <span className="text-[11px] text-[#64748B] uppercase tracking-wider">Depth Score:</span>
            <ScoreGauge score={qualityScore} size="sm" />
          </div>

          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono rounded-lg border border-slate-700/60 bg-[#1E293B] text-[#F8FAFC] hover:border-[#C8F25C]/50 hover:text-[#C8F25C] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
            />
            <span>Refresh Dossier</span>
          </button>

          {/* Prominent High-Priority "Create Outreach" CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onClick={handleOpenDraftWorkspace}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-semibold rounded-lg border border-[#C8F25C] bg-[#C8F25C] text-black hover:bg-[#C8F25C]/90 shadow-[0_0_20px_rgba(200,242,92,0.35)] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Create Outreach</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </motion.button>
        </div>
      </div>

      {!research && !isResearchLoading && !company.summary ? (
        <EmptyState
          title="No intelligence brief available"
          description="Click 'Refresh Dossier' to trigger autonomous crawling of target web surfaces, technology detection, and outreach thesis generation."
          action={{
            label: "Dispatch Research Job",
            onClick: () => refreshMutation.mutate(),
          }}
        />
      ) : (
        /* Aceternity Bento Grid for Company Intelligence */
        <BentoGrid className="pb-8">
          {/* Bento Card 1: Executive Intelligence Brief (md:col-span-2) */}
          <BentoGridItem
            className="md:col-span-2"
            title="Executive Intelligence Brief"
            description={
              research?.summary ||
              company.summary ||
              'Autonomous crawler is synthesizing target market positioning and core value proposition.'
            }
            icon={<Shield className="w-4 h-4" />}
          >
            <div className="pt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#94A3B8] border-t border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="text-[#64748B]">Industry:</span>
                <span className="text-[#F8FAFC]">{research?.industry || company.industry || 'Software / Technology'}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#64748B]">Stage:</span>
                <span className="text-[#F8FAFC]">{company.companyStage || 'Growth Scaleup'}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#64748B]">Target Domain:</span>
                <span className="text-[#C8F25C]">{company.normalizedDomain}</span>
              </div>
            </div>
          </BentoGridItem>

          {/* Bento Card 2: Growth & Hiring Signals (md:col-span-1) */}
          <BentoGridItem
            className="md:col-span-1"
            title="Growth & Open Roles Used"
            description="Autonomous telemetry derived from public job boards and career gateways."
            icon={<Zap className="w-4 h-4 text-amber-400" />}
          >
            <div className="space-y-2.5 text-xs font-mono pt-1">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1117] border border-slate-800">
                <span className="text-[#94A3B8]">Hiring Velocity:</span>
                <span className="text-[#C8F25C] font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C8F25C] animate-pulse" />
                  Active Roles
                </span>
              </div>

              {company.hiringSignals && company.hiringSignals.length > 0 ? (
                <div className="p-2.5 rounded-lg bg-[#0D1117] border border-slate-800 space-y-1">
                  <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">
                    Detected Open Roles:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {company.hiringSignals.slice(0, 2).map((role: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#161F2C] border border-slate-700/60 text-[#F8FAFC]">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {research?.careersPageUrl && (
                <a
                  href={research.careersPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-[#0D1117] border border-slate-800 text-[#C8F25C] hover:underline"
                >
                  <span>Careers Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </BentoGridItem>

          {/* Bento Card 3: Synthesized Outreach Thesis (md:col-span-2) */}
          <BentoGridItem
            className="md:col-span-2"
            title="Synthesized Outreach Thesis (Outreach V7)"
            description="Grounding vectors extracted for candidate positioning and personalization."
            icon={<Target className="w-4 h-4 text-[#C8F25C]" />}
          >
            <div className="space-y-3 pt-2">
              {hooks?.whyThisCompany && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block">
                    1. Why This Company
                  </span>
                  <div className="p-3 rounded-lg bg-[#0D1117] border border-slate-800 text-xs text-[#F8FAFC] leading-relaxed">
                    {hooks.whyThisCompany}
                  </div>
                </div>
              )}

              {hooks?.whyNow && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block">
                    2. Why Now (Inflection Point / Timing)
                  </span>
                  <div className="p-3 rounded-lg bg-[#0D1117] border border-slate-800 text-xs text-[#F8FAFC] leading-relaxed">
                    {hooks.whyNow}
                  </div>
                </div>
              )}

              {hooks?.keyProblemsSolving && hooks.keyProblemsSolving.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block">
                    3. Core Problems Solved
                  </span>
                  <ul className="list-disc list-inside space-y-1 p-3 rounded-lg bg-[#0D1117] border border-slate-800 text-xs text-[#94A3B8]">
                    {hooks.keyProblemsSolving.map((p, i) => (
                      <li key={i} className="text-[#F8FAFC]">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!hooks?.whyThisCompany && !hooks?.whyNow && (
                <div className="p-3 rounded-lg bg-[#0D1117] border border-slate-800 text-xs text-[#64748B] italic">
                  Outreach hooks are generated automatically when research crawler completes.
                </div>
              )}
            </div>
          </BentoGridItem>

          {/* Bento Card 4: Technology Topography (md:col-span-1) */}
          <BentoGridItem
            className="md:col-span-1"
            title="Technology Topography"
            description="Detected tech stack signatures and frameworks from web surfaces."
            icon={<Cpu className="w-4 h-4 text-[#C8F25C]" />}
          >
            {((research?.techStack && research.techStack.length > 0) || (company.techSignals && company.techSignals.length > 0)) ? (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {(research?.techStack || company.techSignals || []).map((tech: string, i: number) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-[#0D1117] border border-slate-800 text-[#F8FAFC] hover:border-[#C8F25C]/50 hover:text-[#C8F25C] transition-colors"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#0D1117] border border-slate-800 text-xs text-[#64748B] italic">
                No technical signals discovered yet.
              </div>
            )}
          </BentoGridItem>

          {/* Bento Card 5: Terminal: Scraped Intelligence Stream (md:col-span-3) */}
          <BentoGridItem
            className="md:col-span-3"
            title="Terminal: Scraped Intelligence Stream"
            description="Raw markdown crawler stream from target public web surfaces."
            icon={<Terminal className="w-4 h-4 text-[#C8F25C]" />}
          >
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowTerminal(!showTerminal)}
                  className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
                >
                  {showTerminal ? (
                    <ChevronDown className="w-4 h-4 text-[#C8F25C]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#C8F25C]" />
                  )}
                  <span>{showTerminal ? 'Collapse Scraped Stream' : 'Expand Scraped Stream'}</span>
                </button>

                {showTerminal && rawStreamContent && (
                  <button
                    onClick={handleCopyTerminal}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-md bg-[#0D1117] border border-slate-800 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
                  >
                    {copiedTerminal ? (
                      <>
                        <Check className="w-3 h-3 text-[#C8F25C]" />
                        <span className="text-[#C8F25C]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Raw Markdown</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showTerminal && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117] font-mono text-[11px] max-h-96 overflow-y-auto leading-relaxed text-[#94A3B8] whitespace-pre-wrap select-text shadow-inner">
                      {rawStreamContent || (
                        <span className="italic text-[#64748B]">
                          No raw terminal stream available for this target company.
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </BentoGridItem>
        </BentoGrid>
      )}
    </div>
  );
};
