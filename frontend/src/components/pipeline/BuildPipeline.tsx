import React from 'react';
import { motion } from 'framer-motion';
import {
  FileDown,
  Cpu,
  PenTool,
  CheckCircle2,
  Send,
  Loader2,
} from 'lucide-react';
import { CampaignOverviewDto } from '../../types/campaign';

interface BuildPipelineProps {
  overview?: CampaignOverviewDto | null;
  status: string;
}

export const BuildPipeline: React.FC<BuildPipelineProps> = ({ overview, status }) => {
  const total = overview?.totalProspects ?? 0;
  const researched = overview?.researchedProspects ?? 0;
  const synthesized = overview?.synthesizedProspects ?? (overview?.processedProspects ?? (overview?.draftsGenerated ?? 0));
  const drafted = overview?.draftsGenerated ?? 0;
  const reviewCount = overview?.manualReviewCount ?? 0;
  const approved = overview?.approvedCount ?? (overview?.status === 'COMPLETED' ? drafted : 0);
  const gmailCreated = overview?.gmailDraftCount ?? 0;

  // Determine active running stage based on campaign progression
  const isImportComplete = total > 0;
  const isResearchRunning = status === 'ACTIVE' && researched < total;
  const isResearchComplete = researched >= total && total > 0;
  const isDraftingRunning = isResearchComplete && synthesized < total;
  const isDraftingComplete = synthesized >= total && total > 0;
  const isReviewStage = isDraftingComplete && approved < drafted;
  const isGmailComplete = isDraftingComplete && drafted > 0 && gmailCreated >= drafted;

  const stages = [
    {
      id: 'import',
      name: 'Import Job',
      label: 'Prospects Ingested',
      count: total,
      status: isImportComplete ? 'completed' : 'pending',
      icon: FileDown,
    },
    {
      id: 'research',
      name: 'Deep Research',
      label: 'Company Intelligence',
      count: `${researched}/${total}`,
      status: isResearchComplete
        ? 'completed'
        : isResearchRunning
        ? 'running'
        : 'waiting',
      icon: Cpu,
    },
    {
      id: 'draft',
      name: 'AI Synthesizer',
      label: 'V7 Drafts Generated',
      count: `${synthesized}/${total}`,
      status: isDraftingComplete
        ? 'completed'
        : isDraftingRunning
        ? 'running'
        : 'waiting',
      icon: PenTool,
    },
    {
      id: 'review',
      name: 'Human Operator',
      label: 'Approved by Human',
      count: `${approved}/${drafted}`,
      status:
        approved >= drafted && drafted > 0
          ? 'completed'
          : isReviewStage
          ? 'blocked'
          : 'waiting',
      icon: CheckCircle2,
    },
    {
      id: 'gmail',
      name: 'Gmail Dispatch',
      label: 'Staged in Mailbox',
      count: `${gmailCreated}/${drafted}`,
      status: isGmailComplete ? 'completed' : isDraftingComplete && approved > 0 ? 'running' : 'waiting',
      icon: Send,
    },
  ];

  return (
    <div className="p-6 rounded-xl border border-white/[0.08] bg-[#151922] shadow-operator select-none space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#C8F25C] animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider text-[#F8FAFC] font-semibold">
            CI/CD Pipeline Execution Graph (Magic UI Beam)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[#94A3B8]">
          <span>RUN: #{overview?.campaignId.slice(0, 8) || 'active'}</span>
          <span className="text-[#64748B]">•</span>
          <span className="text-[#C8F25C] uppercase">{status}</span>
        </div>
      </div>

      {/* Magic UI Animated Beam Pipeline Conduit Graph */}
      <div className="pt-4 pb-2 overflow-x-auto">
        <div className="min-w-[700px] relative px-6 py-4">
          {/* Animated SVG Laser Conduit Beams connecting the 5 nodes */}
          <svg
            className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible"
            style={{ zIndex: 0 }}
          >
            <defs>
              <linearGradient id="magic-beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C8F25C" stopOpacity="0" />
                <stop offset="50%" stopColor="#C8F25C" stopOpacity="1" />
                <stop offset="100%" stopColor="#C8F25C" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Connecting lines between adjacent nodes (calculated across 5 evenly-spaced nodes) */}
            {[0, 1, 2, 3].map((idx) => {
              const startPercent = 10 + idx * 20;
              const endPercent = 10 + (idx + 1) * 20;
              const isStageActive = stages[idx].status === 'completed' || stages[idx].status === 'running';

              return (
                <g key={idx}>
                  {/* Static background conduit */}
                  <line
                    x1={`${startPercent}%`}
                    y1="36px"
                    x2={`${endPercent}%`}
                    y2="36px"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />

                  {/* Magic UI Animated Laser Beam if stage is running or completed */}
                  {isStageActive && (
                    <motion.line
                      x1={`${startPercent}%`}
                      y1="36px"
                      x2={`${endPercent}%`}
                      y2="36px"
                      stroke="url(#magic-beam-gradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: 100, strokeDasharray: '25 100' }}
                      animate={{ strokeDashoffset: -100 }}
                      transition={{
                        repeat: Infinity,
                        duration: 2,
                        ease: 'linear',
                        delay: idx * 0.4,
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Pipeline Stage Nodes */}
          <div className="flex items-center justify-between relative z-10">
            {stages.map((stage) => {
              const Icon = stage.icon;
              const isCompleted = stage.status === 'completed';
              const isRunning = stage.status === 'running';
              const isBlocked = stage.status === 'blocked';

              let nodeClass = 'border-white/[0.08] bg-[#0F1115] text-[#94A3B8]';
              let badgeClass = 'bg-[#151922] border-white/[0.08] text-[#94A3B8]';

              if (isCompleted) {
                nodeClass = 'border-[#C8F25C] bg-[#1A2030] text-[#C8F25C] shadow-[0_0_12px_rgba(200,242,92,0.25)]';
                badgeClass = 'bg-[#1A2030] border-[#C8F25C]/40 text-[#C8F25C]';
              } else if (isRunning) {
                nodeClass = 'border-[#C8F25C] bg-[#1A2030] text-[#C8F25C] shadow-[0_0_16px_rgba(200,242,92,0.4)] animate-pulse';
                badgeClass = 'bg-[#1A2030] border-[#C8F25C]/60 text-[#C8F25C] font-semibold';
              } else if (isBlocked) {
                nodeClass = 'border-amber-400 bg-[#1A2030] text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]';
                badgeClass = 'bg-[#1A2030] border-amber-400/40 text-amber-400 font-semibold';
              }

              return (
                <div key={stage.id} className="flex flex-col items-center group">
                  {/* Stage Node Circle with Spring State Animation */}
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors cursor-default ${nodeClass}`}
                  >
                    {isRunning ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#C8F25C]" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </motion.div>

                  {/* Stage Name & Count */}
                  <div className="mt-3 text-center space-y-0.5">
                    <div className="text-xs font-semibold text-[#F8FAFC] font-sans">
                      {stage.name}
                    </div>
                    <div className="text-[10px] font-mono text-[#64748B]">
                      {stage.label}
                    </div>
                    <div className="pt-1">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeClass}`}
                      >
                        {stage.count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
