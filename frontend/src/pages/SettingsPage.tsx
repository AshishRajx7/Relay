import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  Server,
  Cpu,
  Database,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import { systemService } from '../services/systemService';
import { StatusBadge } from '../components/common/StatusBadge';

export const SettingsPage: React.FC = () => {
  // 1. Backend Health Query
  const {
    data: systemHealth,
    isLoading: isSystemLoading,
    refetch: refetchSystem,
  } = useQuery({
    queryKey: ['settings-system-health'],
    queryFn: () => systemService.getHealth(),
  });

  // 2. AI Telemetry Query
  const {
    data: aiHealth,
    isLoading: isAiLoading,
    refetch: refetchAi,
  } = useQuery({
    queryKey: ['settings-ai-health'],
    queryFn: () => systemService.getAIHealth(),
  });

  const handleRefresh = () => {
    refetchSystem();
    refetchAi();
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#F8FAFC] flex items-center gap-2.5 font-sans">
            <Settings className="w-5 h-5 text-[#C8F25C]" />
            Settings & Telemetry
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-sans">
            Relational storage, queue workers, AI inference endpoints, and candidate document storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-xs rounded-lg border border-slate-800 text-[#94A3B8] hover:text-[#F8FAFC] bg-[#161F2C] hover:bg-[#1E293B] transition-colors"
            title="Refresh Diagnostics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        {/* Backend Infrastructure Services */}
        <div className="p-6 rounded-xl border border-slate-800/80 bg-[#161F2C] shadow-operator space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-mono uppercase tracking-wider text-[#F8FAFC] font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-[#C8F25C]" />
              Infrastructure Services
            </span>
            <StatusBadge status={systemHealth?.status === 'ok' ? 'HEALTHY' : 'PENDING'} size="sm" />
          </div>

          {isSystemLoading ? (
            <div className="text-xs font-mono text-[#94A3B8] p-4 text-center flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C8F25C]" />
              Testing backend services...
            </div>
          ) : (
            <div className="space-y-3">
              {/* PostgreSQL */}
              <div className="p-3.5 rounded-lg bg-[#0D1117] border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-[#C8F25C]" />
                  <div>
                    <div className="text-xs font-medium text-[#F8FAFC]">PostgreSQL Database</div>
                    <div className="text-[10px] font-mono text-[#64748B]">
                      Relational store for targets, campaigns, prospects, and generated drafts
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#C8F25C]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{systemHealth?.services?.database || 'Connected'}</span>
                </div>
              </div>

              {/* Redis */}
              <div className="p-3.5 rounded-lg bg-[#0D1117] border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-[#C8F25C]" />
                  <div>
                    <div className="text-xs font-medium text-[#F8FAFC]">Redis & BullMQ Engine</div>
                    <div className="text-[10px] font-mono text-[#64748B]">
                      Asynchronous queue manager for deep company crawling and outreach drafting
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#C8F25C]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{systemHealth?.services?.redis || 'Connected'}</span>
                </div>
              </div>

              {/* PDF Storage */}
              <div className="p-3.5 rounded-lg bg-[#0D1117] border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-[#C8F25C]" />
                  <div>
                    <div className="text-xs font-medium text-[#F8FAFC]">Local PDF Resume Storage</div>
                    <div className="text-[10px] font-mono text-[#64748B]">
                      Candidate PDF document attachments for Gmail draft staging
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#C8F25C]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{systemHealth?.services?.storage || 'Ready'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Inference Configuration */}
        <div className="p-6 rounded-xl border border-slate-800/80 bg-[#161F2C] shadow-operator space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-mono uppercase tracking-wider text-[#F8FAFC] font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#C8F25C]" />
              AI Inference Telemetry
            </span>
            <StatusBadge status={aiHealth?.configured ? 'ACTIVE' : 'PENDING'} size="sm" />
          </div>

          {isAiLoading ? (
            <div className="text-xs font-mono text-[#94A3B8] p-4 text-center flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C8F25C]" />
              Querying AI pipeline telemetry...
            </div>
          ) : (
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-[#0D1117] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Inference Provider:</span>
                  <span className="text-[#F8FAFC] font-semibold uppercase">
                    {aiHealth?.provider || 'NVIDIA NIM / OPENAI'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Primary LLM Model:</span>
                  <span className="text-[#C8F25C] font-semibold">
                    {aiHealth?.model || 'meta/llama-3.2-3b-instruct'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">API Endpoint:</span>
                  <span className="text-[#94A3B8] truncate max-w-xs">
                    {aiHealth?.baseUrl || 'https://integrate.api.nvidia.com/v1'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-[#64748B]">Configuration Status:</span>
                  {aiHealth?.configured ? (
                    <span className="text-[#C8F25C] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Operational & Responsive
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Unconfigured
                    </span>
                  )}
                </div>
              </div>

              {/* Outreach V7 Compliance Badge */}
              <div className="p-3.5 rounded-lg bg-[#0D1117] border border-slate-800 space-y-1">
                <div className="text-[#F8FAFC] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#C8F25C]" />
                  Outreach Ruleset: V7
                </div>
                <p className="text-[#94A3B8] text-[11px] font-sans leading-relaxed">
                  Strict 65–80 word target, human engineer tone, work experience prioritized before projects, 4 paragraphs, automated PDF resume attachment.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
