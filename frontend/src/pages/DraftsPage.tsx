import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  RefreshCw,
  ArrowRight,
  Search,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { draftService } from '../services/draftService';
import { EmailDraft } from '../types/draft';

export const DraftsPage: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ['drafts-queue', statusFilter],
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

  // Keyboard navigation (j / k / Enter / / search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === searchInputRef.current) {
        if (e.key === 'Escape') {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, filteredDrafts.length - 1)));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (filteredDrafts[selectedIndex]) {
          navigate(`/drafts/${filteredDrafts[selectedIndex].id}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredDrafts, selectedIndex, navigate]);

  const filterTabs: { id: string; label: string }[] = [
    { id: 'ALL', label: 'All Queue' },
    { id: 'REVIEW_REQUIRED', label: 'Needs Review' },
    { id: 'GENERATED', label: 'Ready' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'GMAIL_DRAFT_CREATED', label: 'Synced to Gmail' },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0D1117] overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="px-8 py-4 border-b border-slate-800 bg-[#161F2C]/80 backdrop-blur-md shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#1E293B] border border-slate-700/60 text-[#C8F25C] shadow-sm">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-[#F8FAFC] font-sans">
                Review Queue
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.2 rounded-full bg-[#1E293B] border border-slate-800 text-[#C8F25C]">
                {filteredDrafts.length} drafts
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5">
              Press <kbd className="px-1 py-0.2 rounded bg-[#0D1117] border border-slate-800 text-[#F8FAFC]">j</kbd> / <kbd className="px-1 py-0.2 rounded bg-[#0D1117] border border-slate-800 text-[#F8FAFC]">k</kbd> to triage • <kbd className="px-1 py-0.2 rounded bg-[#0D1117] border border-slate-800 text-[#F8FAFC]">↵</kbd> open workspace • <kbd className="px-1 py-0.2 rounded bg-[#0D1117] border border-slate-800 text-[#F8FAFC]">/</kbd> search
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter queue (/)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-800 bg-[#161F2C] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-hidden focus:border-[#C8F25C]/50 font-sans transition-colors"
            />
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 text-xs rounded-lg border border-slate-800 text-[#94A3B8] hover:text-[#F8FAFC] bg-[#161F2C] hover:bg-[#1E293B] transition-colors shrink-0"
            title="Refresh Queue"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs Subheader */}
      <div className="px-8 py-2 border-b border-slate-800 bg-[#0D1117] flex items-center gap-1.5 shrink-0 overflow-x-auto">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setStatusFilter(tab.id);
              setSelectedIndex(0);
            }}
            className={`px-3 py-1 text-xs font-mono rounded-md transition-colors whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-[#1E293B] text-[#C8F25C] border border-[#C8F25C]/30 font-semibold'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161F2C]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Magic UI Animated List / Decision Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-2">
          {isLoading ? (
            <div className="p-12 text-center text-xs font-mono text-[#94A3B8] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
              Loading decision stream...
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="p-12 rounded-xl border border-slate-800 bg-[#161F2C] text-center space-y-3">
              <div className="p-3 rounded-full bg-[#1E293B] text-[#C8F25C] w-fit mx-auto border border-slate-800">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#F8FAFC]">No drafts awaiting review</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto font-sans leading-relaxed">
                Select a company from the Directory to generate tailored outreach drafts.
              </p>
              <button
                onClick={() => navigate('/')}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#B8E24C] transition-colors"
              >
                Open Company Directory
              </button>
            </div>
          ) : (
            <AnimatePresence>
              {filteredDrafts.map((draft, idx) => {
                const isSelected = idx === selectedIndex;
                const prospectName =
                  draft.prospect?.firstName || draft.prospect?.lastName
                    ? `${draft.prospect.firstName || ''} ${draft.prospect.lastName || ''}`.trim()
                    : draft.prospect?.email;
                const company = draft.prospect?.companyName || draft.prospect?.domain || 'Target';
                const qualityScore =
                  draft.quality?.confidenceScore ??
                  (draft.quality?.personalizationScore
                    ? Math.round(
                        (draft.quality.personalizationScore +
                          draft.quality.relevanceScore +
                          draft.quality.technicalAlignmentScore) /
                          3
                      )
                    : 90);

                // Status styling
                let statusPill = 'Ready';
                let statusPillClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                let statusDot = 'bg-blue-400';

                if (draft.status === 'APPROVED') {
                  statusPill = 'Approved';
                  statusPillClass = 'bg-[#A3E635]/15 text-[#A3E635] border-[#A3E635]/30';
                  statusDot = 'bg-[#A3E635] shadow-[0_0_8px_#A3E635]';
                } else if (draft.status === 'REVIEW_REQUIRED') {
                  statusPill = 'Needs Review';
                  statusPillClass = 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30';
                  statusDot = 'bg-[#FBBF24]';
                } else if (draft.status === 'GMAIL_DRAFT_CREATED') {
                  statusPill = 'Synced';
                  statusPillClass = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
                  statusDot = 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]';
                } else if (draft.status === 'REJECTED') {
                  statusPill = 'Rejected';
                  statusPillClass = 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30';
                  statusDot = 'bg-[#EF4444]';
                }

                const words = (draft.body || '').trim().split(/\s+/).filter((w) => w.length > 0).length;

                return (
                  <motion.div
                    key={draft.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    whileHover={{ scale: 1.006, y: -2 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    onClick={() => navigate(`/drafts/${draft.id}`)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-4 py-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-4 group ${
                      isSelected
                        ? 'bg-[#1E293B] border-[#C8F25C]/50 shadow-lg shadow-black/50'
                        : 'bg-[#161F2C] border-slate-800 hover:border-slate-700 hover:bg-[#1E293B]'
                    }`}
                  >
                    {/* Left: Indicator Dot & Prospect Info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-semibold text-sm text-[#F8FAFC] truncate">
                            {prospectName}
                          </span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#0D1117] border border-slate-800 text-[#94A3B8] shrink-0">
                            {company}
                          </span>
                          {words > 0 && (
                            <span className="font-mono text-[10px] text-[#64748B]">
                              {words}w
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#94A3B8] truncate mt-0.5 font-sans">
                          {draft.subject || 'Draft ready for triage...'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Quality Score, Status Pill, Open Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Quality Score in JetBrains Mono */}
                      <div className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#0D1117] border border-slate-800 flex items-center gap-1">
                        <span className="text-[#64748B] text-[10px]">QUALITY:</span>
                        <span className="text-[#C8F25C]">{qualityScore}</span>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${statusPillClass}`}
                      >
                        {statusPill}
                      </span>

                      {/* Arrow Action */}
                      <div className="w-7 h-7 rounded-lg border border-slate-800 bg-[#0D1117] flex items-center justify-center text-[#94A3B8] group-hover:text-[#C8F25C] group-hover:border-[#C8F25C]/40 transition-colors">
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};
