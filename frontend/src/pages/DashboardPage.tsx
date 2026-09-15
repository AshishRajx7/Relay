import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Mail,
  Building2,
  Send,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Activity,
  Plus,
} from 'lucide-react';
import { campaignService } from '../services/campaignService';
import { draftService } from '../services/draftService';
import { companyService } from '../services/companyService';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Campaigns Query
  const { data: campaigns } = useQuery({
    queryKey: ['dashboard-campaigns'],
    queryFn: () => campaignService.getAll(),
  });

  // 2. Drafts Queries
  const { data: reviewDrafts } = useQuery({
    queryKey: ['dashboard-drafts-review'],
    queryFn: () => draftService.getAll(undefined, 'REVIEW_REQUIRED'),
  });

  const { data: gmailDrafts } = useQuery({
    queryKey: ['dashboard-drafts-gmail'],
    queryFn: () => draftService.getAll(undefined, 'GMAIL_DRAFT_CREATED'),
  });

  // 3. Companies Query
  const { data: companies } = useQuery({
    queryKey: ['dashboard-companies'],
    queryFn: () => companyService.getAll(),
  });

  const activeCampaignsCount = (campaigns || []).filter((c) => c.status === 'ACTIVE').length;
  const reviewCount = reviewDrafts?.length || 0;
  const researchedCompaniesCount = (companies || []).filter(
    (c) => c.research?.status === 'COMPLETED'
  ).length;
  const gmailCreatedCount = gmailDrafts?.length || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-relay-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-relay-text">
            Relay Operator System
          </h1>
          <p className="text-xs text-relay-muted mt-1">
            AI-powered cold outreach operating system. Automated research and drafting with human-in-the-loop review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/campaigns')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover transition-colors shadow-operator"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* 4 Core Operator Metrics (Exactly as requested) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Campaigns Active"
          value={activeCampaignsCount}
          description={`${campaigns?.length || 0} total campaigns initialized`}
          icon={<Layers className="w-4 h-4 text-relay-accent" />}
        />

        <MetricCard
          title="Drafts Awaiting Review"
          value={reviewCount}
          description="Requires operator approval"
          icon={<Mail className="w-4 h-4 text-amber-400" />}
        />

        <MetricCard
          title="Companies Researched"
          value={researchedCompaniesCount}
          description={`${companies?.length || 0} total registered targets`}
          icon={<Building2 className="w-4 h-4 text-blue-400" />}
        />

        <MetricCard
          title="Gmail Drafts Created"
          value={gmailCreatedCount}
          description="Handed off to Gmail"
          icon={<Send className="w-4 h-4 text-relay-success" />}
        />
      </div>

      {/* Secondary: Operator Queue & Honest Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Actionable Operator Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-relay-text font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-relay-accent" />
              Operator Action Queue
            </span>
            <span className="text-[11px] font-mono text-relay-subtle">
              Priority Actions
            </span>
          </div>

          <div className="rounded-lg border border-relay-border bg-relay-card overflow-hidden shadow-operator">
            {reviewCount === 0 && (!campaigns || campaigns.length === 0) ? (
              <div className="p-8 text-center text-xs font-mono text-relay-subtle space-y-2">
                <div>No pending operator actions.</div>
                <div className="text-[11px] text-relay-muted">
                  Create a campaign or upload prospects to begin the outreach lifecycle.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-relay-border/60">
                {/* Draft Review Items */}
                {reviewDrafts && reviewDrafts.length > 0 && (
                  reviewDrafts.slice(0, 5).map((draft) => (
                    <div
                      key={draft.id}
                      onClick={() => navigate(`/drafts/${draft.id}`)}
                      className="p-4 flex items-center justify-between hover:bg-relay-card-hover cursor-pointer transition-colors group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            REVIEW DRAFT
                          </span>
                          <span className="text-xs font-medium text-relay-text">
                            {draft.prospect?.companyName || 'Target Company'}
                          </span>
                        </div>
                        <div className="text-xs text-relay-muted font-mono truncate max-w-md">
                          {draft.subject || 'Draft ready for review'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-relay-muted group-hover:text-relay-accent">
                        <span>Review</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))
                )}

                {/* Campaign Attention Items */}
                {campaigns && campaigns.filter((c) => c.status === 'DRAFT').map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                    className="p-4 flex items-center justify-between hover:bg-relay-card-hover cursor-pointer transition-colors group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} size="sm" />
                        <span className="text-xs font-medium text-relay-text">
                          {c.name}
                        </span>
                      </div>
                      <div className="text-xs text-relay-muted font-mono">
                        Campaign in Draft status. Ready to upload prospects and start.
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-relay-muted group-hover:text-relay-accent">
                      <span>Open Mission Control</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Recent Activity & System Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-relay-text font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-relay-accent" />
              Recent Activity
            </span>
          </div>

          <div className="p-5 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-4">
            {/* Honest Activity Notice as per instructions */}
            <div className="p-3.5 rounded bg-relay-bg border border-relay-border space-y-1.5 text-xs">
              <div className="font-mono text-[11px] text-relay-muted font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-relay-accent" />
                Pipeline Tracking Active
              </div>
              <p className="text-relay-subtle text-[11px] leading-relaxed">
                Activity tracking coming soon. Granular event-sourced logs will connect to BullMQ queue workers.
              </p>
            </div>

            {/* Quick Summary Counts */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-relay-muted">
                <span>Total Campaigns:</span>
                <span className="text-relay-text font-semibold">{campaigns?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between text-relay-muted">
                <span>Targets Researched:</span>
                <span className="text-relay-text font-semibold">{researchedCompaniesCount}</span>
              </div>
              <div className="flex items-center justify-between text-relay-muted">
                <span>Gmail Drafts Ready:</span>
                <span className="text-relay-accent font-semibold">{gmailCreatedCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
