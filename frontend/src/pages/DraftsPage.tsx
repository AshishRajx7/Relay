import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Mail, RefreshCw, ArrowRight, Filter, Search } from 'lucide-react';
import { draftService } from '../services/draftService';
import { StatusBadge } from '../components/common/StatusBadge';
import { ScoreGauge } from '../components/common/ScoreGauge';
import { EmptyState } from '../components/common/EmptyState';
import { OutreachDraftStatus } from '../types/draft';

export const DraftsPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ['drafts-list', statusFilter],
    queryFn: () => draftService.getAll(undefined, statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const filteredDrafts = (drafts || []).filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const prospectName = `${d.prospect?.firstName || ''} ${d.prospect?.lastName || ''}`.toLowerCase();
    const company = (d.prospect?.companyName || '').toLowerCase();
    const subject = (d.subject || '').toLowerCase();
    return prospectName.includes(q) || company.includes(q) || subject.includes(q);
  });

  const filterTabs: { id: string; label: string }[] = [
    { id: 'ALL', label: 'All Drafts' },
    { id: 'REVIEW_REQUIRED', label: 'Review Required' },
    { id: 'GENERATED', label: 'Generated' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'GMAIL_DRAFT_CREATED', label: 'Synced to Gmail' },
    { id: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-relay-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-relay-text flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-relay-accent" />
            Draft Review Queue
          </h1>
          <p className="text-xs text-relay-muted mt-1">
            Personalized job application drafts awaiting human verification, quality checks, and Gmail synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-xs rounded border border-relay-border text-relay-muted hover:text-relay-text bg-relay-card transition-colors"
            title="Refresh Draft Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg border border-relay-border bg-relay-card overflow-x-auto max-w-full">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-relay-accent text-black font-semibold shadow-xs'
                  : 'text-relay-muted hover:text-relay-text hover:bg-relay-bg'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-relay-subtle" />
          <input
            type="text"
            placeholder="Filter by name, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-relay-border bg-relay-card text-relay-text placeholder:text-relay-subtle focus:outline-hidden focus:border-relay-accent font-sans"
          />
        </div>
      </div>

      {/* Drafts Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
          Loading draft queue...
        </div>
      ) : filteredDrafts.length === 0 ? (
        <EmptyState
          title="No drafts in queue"
          description={
            statusFilter !== 'ALL'
              ? `No drafts found matching status "${statusFilter}".`
              : "No outreach drafts have been generated yet. Open a campaign and trigger draft generation."
          }
          action={{
            label: "Go to Campaigns",
            onClick: () => navigate('/campaigns'),
          }}
        />
      ) : (
        <div className="rounded-lg border border-relay-border bg-relay-card overflow-hidden shadow-operator">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-relay-border bg-relay-bg/60 font-mono text-[11px] text-relay-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Prospect</th>
                <th className="py-3 px-4">Target Company</th>
                <th className="py-3 px-4">Draft Subject</th>
                <th className="py-3 px-4 text-center">Quality</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-relay-border/60">
              {filteredDrafts.map((draft) => {
                const prospectName = draft.prospect?.firstName || draft.prospect?.lastName
                  ? `${draft.prospect.firstName || ''} ${draft.prospect.lastName || ''}`.trim()
                  : draft.prospect?.email;
                const company = draft.prospect?.companyName || draft.prospect?.domain || '—';
                const qualityScore = draft.quality?.confidenceScore ?? (draft.quality?.personalizationScore ? Math.round((draft.quality.personalizationScore + draft.quality.relevanceScore + draft.quality.technicalAlignmentScore) / 3) : 0);

                return (
                  <tr
                    key={draft.id}
                    onClick={() => navigate(`/drafts/${draft.id}`)}
                    className="hover:bg-relay-card-hover/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-medium text-relay-text">
                      <div className="font-sans font-medium text-relay-text">{prospectName}</div>
                      {draft.prospect?.title && (
                        <div className="text-[11px] font-mono text-relay-subtle line-clamp-1">
                          {draft.prospect.title}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-relay-muted">
                      {company}
                    </td>

                    <td className="py-3 px-4 text-relay-muted font-sans max-w-xs truncate">
                      {draft.subject || <span className="italic text-relay-subtle">No subject</span>}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex justify-center">
                        <ScoreGauge score={qualityScore} maxScore={100} size="sm" />
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={draft.status} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/drafts/${draft.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded border border-relay-border bg-relay-bg text-relay-text hover:border-relay-accent hover:text-relay-accent transition-colors"
                      >
                        Review
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
