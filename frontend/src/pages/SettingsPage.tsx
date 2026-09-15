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
  // 1. System Health Query
  const {
    data: systemHealth,
    isLoading: isSystemLoading,
    refetch: refetchSystem,
  } = useQuery({
    queryKey: ['settings-system-health'],
    queryFn: () => systemService.getHealth(),
  });

  // 2. AI Health Query
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
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-relay-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-relay-text flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-relay-accent" />
            System Status & Configuration
          </h1>
          <p className="text-xs text-relay-muted mt-1">
            Real-time backend infrastructure telemetry, AI inference endpoints, database connectivity, and background queues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-xs rounded border border-relay-border text-relay-muted hover:text-relay-text bg-relay-card transition-colors"
            title="Refresh Diagnostics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System & Infrastructure Health */}
        <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-relay-border">
            <span className="text-xs font-mono uppercase tracking-wider text-relay-text font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-relay-accent" />
              Infrastructure Diagnostics
            </span>
            <StatusBadge status={systemHealth?.status === 'ok' ? 'HEALTHY' : 'PENDING'} size="sm" />
          </div>

          {isSystemLoading ? (
            <div className="text-xs font-mono text-relay-muted p-4 text-center">
              Testing backend services...
            </div>
          ) : (
            <div className="space-y-3">
              {/* PostgreSQL */}
              <div className="p-3.5 rounded bg-relay-bg border border-relay-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-relay-accent" />
                  <div>
                    <div className="text-xs font-medium text-relay-text">PostgreSQL Database</div>
                    <div className="text-[10px] font-mono text-relay-subtle">
                      Relational store for campaigns, prospects, company profiles, and drafts
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-relay-success">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{systemHealth?.services?.database || 'Connected'}</span>
                </div>
              </div>

              {/* Redis */}
              <div className="p-3.5 rounded bg-relay-bg border border-relay-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="text-xs font-medium text-relay-text">Redis & BullMQ Engine</div>
                    <div className="text-[10px] font-mono text-relay-subtle">
                      Asynchronous queue manager for deep research and AI drafting
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-relay-success">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{systemHealth?.services?.redis || 'Connected'}</span>
                </div>
              </div>

              {/* Storage */}
              <div className="p-3.5 rounded bg-relay-bg border border-relay-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-medium text-relay-text">Local PDF Resume Storage</div>
                    <div className="text-[10px] font-mono text-relay-subtle">
                      Candidate PDF attachments for Gmail draft handoff
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-relay-success">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{systemHealth?.services?.storage || 'Ready'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Inference Configuration */}
        <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-relay-border">
            <span className="text-xs font-mono uppercase tracking-wider text-relay-text font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-relay-accent" />
              AI Intelligence Pipeline
            </span>
            <StatusBadge status={aiHealth?.configured ? 'ACTIVE' : 'PENDING'} size="sm" />
          </div>

          {isAiLoading ? (
            <div className="text-xs font-mono text-relay-muted p-4 text-center">
              Querying AI pipeline telemetry...
            </div>
          ) : (
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3.5 rounded bg-relay-bg border border-relay-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle">Inference Provider:</span>
                  <span className="text-relay-text font-semibold uppercase">
                    {aiHealth?.provider || 'NVIDIA NIM / OPENAI'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle">Primary LLM Model:</span>
                  <span className="text-relay-accent font-semibold">
                    {aiHealth?.model || 'meta/llama-3.2-3b-instruct'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-relay-subtle">API Base URL:</span>
                  <span className="text-relay-muted truncate max-w-xs">
                    {aiHealth?.baseUrl || 'https://integrate.api.nvidia.com/v1'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-relay-border/60">
                  <span className="text-relay-subtle">Configuration Status:</span>
                  {aiHealth?.configured ? (
                    <span className="text-relay-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Configured & Operational
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Unconfigured
                    </span>
                  )}
                </div>
              </div>

              {/* Outreach V7 Compliance Badge */}
              <div className="p-3.5 rounded bg-relay-bg border border-relay-border space-y-1">
                <div className="text-relay-text font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-relay-accent" />
                  Outreach Engine Ruleset: V7
                </div>
                <p className="text-relay-subtle text-[11px] font-sans leading-relaxed">
                  Target length 65–80 words, human engineer tone, single proof-point focus, strictly 4 paragraphs, automated PDF resume attachment.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
