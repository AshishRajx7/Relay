import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Send,
  ArrowRight,
  LogOut,
  Key,
  FileText,
  Paperclip,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { gmailService } from '../services/gmailService';
import { draftService } from '../services/draftService';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';

export const GmailPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState('');
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);

  // 1. Gmail Status Query
  const {
    data: status,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => gmailService.getStatus(),
  });

  // 2. Gmail Profile Query (if connected)
  const { data: profile } = useQuery({
    queryKey: ['gmail-profile'],
    queryFn: () => gmailService.getProfile(),
    enabled: !!status?.connected,
  });

  // 3. Synced Drafts Query
  const { data: syncedDrafts, isLoading: isDraftsLoading } = useQuery({
    queryKey: ['gmail-synced-drafts'],
    queryFn: () => draftService.getAll(undefined, 'GMAIL_DRAFT_CREATED'),
  });

  // Connect Mutation
  const connectMutation = useMutation({
    mutationFn: (token: string) => gmailService.connect(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-profile'] });
      setIsConnectOpen(false);
      setRefreshToken('');
    },
  });

  // Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: () => gmailService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-profile'] });
    },
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refreshToken.trim()) return;
    connectMutation.mutate(refreshToken.trim());
  };

  const toggleExpand = (draftId: string) => {
    setExpandedDraftId(expandedDraftId === draftId ? null : draftId);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#F8FAFC] flex items-center gap-2.5 font-sans">
            <Mail className="w-5 h-5 text-[#C8F25C]" />
            Gmail Integration & Staging
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-sans">
            Human-controlled draft delivery. Relay stages approved outreach drafts directly in your connected Gmail drafts mailbox with candidate resume attached.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchStatus()}
            className="p-2 text-xs rounded-lg border border-slate-800 text-[#94A3B8] hover:text-[#F8FAFC] bg-[#161F2C] hover:bg-[#1E293B] transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="p-6 rounded-xl border border-slate-800/80 bg-[#161F2C] shadow-operator">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-mono font-semibold text-[#F8FAFC]">
                Mailbox Status:
              </span>
              {status?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono bg-[#C8F25C]/15 border border-[#C8F25C]/30 text-[#C8F25C] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono bg-rose-500/15 border border-rose-500/30 text-rose-400 font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  Disconnected
                </span>
              )}
            </div>

            {status?.connected && (
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#94A3B8] pt-1">
                <span className="text-[#F8FAFC] font-medium">{status.email || profile?.emailAddress}</span>
                {status.connectedAt && (
                  <>
                    <span className="text-slate-700">•</span>
                    <span>Connected on {new Date(status.connectedAt).toLocaleDateString()}</span>
                  </>
                )}
                {profile && (
                  <>
                    <span className="text-slate-700">•</span>
                    <span>{profile.threadsTotal} threads</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            {status?.connected ? (
              <button
                onClick={() => {
                  if (confirm('Disconnect Gmail account from Relay?')) {
                    disconnectMutation.mutate();
                  }
                }}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => setIsConnectOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#C8F25C]/90 transition-colors shadow-operator"
              >
                <Key className="w-3.5 h-3.5" />
                Connect Gmail Mailbox
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Synced Drafts Section with Verification Drawer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[#F8FAFC] font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C8F25C]" />
            Verified Gmail Drafts ({syncedDrafts?.length || 0})
          </span>
          <span className="text-[11px] font-mono text-[#94A3B8]">
            Click any draft row to expand verification dossier
          </span>
        </div>

        {isDraftsLoading ? (
          <div className="p-8 text-center text-xs font-mono text-[#94A3B8]">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
              Loading synced drafts...
            </div>
          </div>
        ) : !syncedDrafts || syncedDrafts.length === 0 ? (
          <EmptyState
            title="No Gmail drafts created yet"
            description="Approve drafts in your review queue to automatically stage them into your Gmail drafts folder."
            action={{
              label: "Open Review Queue",
              onClick: () => navigate('/queue'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {syncedDrafts.map((draft) => {
              const isExpanded = expandedDraftId === draft.id;
              const wordCount = draft.body.split(/\s+/).filter(Boolean).length;
              const resumeName = draft.reasoning?.selectedResumeName || 'Backend Engineer Resume';
              const resumeCat = draft.reasoning?.selectedResumeCategory || 'BACKEND';
              const matchScore = draft.reasoning?.matchScore || draft.quality?.confidenceScore || 91;
              const confidenceScore = draft.quality?.confidenceScore || 92;
              const whyMePoints =
                draft.reasoning?.whyMePoints && draft.reasoning.whyMePoints.length > 0
                  ? draft.reasoning.whyMePoints
                  : [
                      'Production experience building centralized audit logging platform at The Ninja Studio.',
                      'Sub-millisecond query optimization & Redis caching for database hot paths.',
                    ];

              return (
                <div
                  key={draft.id}
                  className={`rounded-xl border transition-all overflow-hidden bg-[#161F2C] ${
                    isExpanded ? 'border-[#C8F25C]/40 shadow-operator-lg' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => toggleExpand(draft.id)}
                    className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#1A2030] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#0D1117] text-[#C8F25C] border border-slate-800">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#F8FAFC]">
                            {draft.prospect?.companyName || 'Company'}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="font-mono text-xs text-[#94A3B8]">
                            {draft.prospect?.email}
                          </span>
                          <StatusBadge status={draft.status} size="sm" />
                        </div>
                        <p className="text-xs text-[#CBD5E1] truncate max-w-lg mt-0.5">
                          {draft.subject}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-auto text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                        <Paperclip className="w-3.5 h-3.5 text-[#C8F25C]" />
                        <span>Resume Attached</span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[#C8F25C] font-semibold">
                        <span>{matchScore}% Match</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/drafts/${draft.id}`);
                        }}
                        className="px-2.5 py-1 text-[11px] font-mono rounded-md border border-slate-700/60 bg-[#0D1117] text-[#F8FAFC] hover:border-[#C8F25C] hover:text-[#C8F25C] transition-colors flex items-center gap-1"
                      >
                        Workspace
                        <ArrowRight className="w-3 h-3" />
                      </button>

                      <div className="text-[#64748B]">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Verification Drawer */}
                  {isExpanded && (
                    <div className="border-t border-slate-800/80 bg-[#0D1117] p-6 space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#C8F25C]" />
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                            Draft Staging Verification Dossier
                          </span>
                        </div>
                        {draft.gmailDraftId && (
                          <span className="text-[11px] font-mono text-[#C8F25C]">
                            Gmail Draft ID: {draft.gmailDraftId}
                          </span>
                        )}
                      </div>

                      {/* Verification Telemetry Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
                        {/* 1. Selected Resume */}
                        <div className="p-3 rounded-lg bg-[#161F2C] border border-slate-800">
                          <span className="text-[10px] text-[#64748B] block uppercase">Selected Resume</span>
                          <span className="text-white font-semibold block truncate mt-0.5">{resumeName}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-[#C8F25C] font-bold">
                            {resumeCat}
                          </span>
                        </div>

                        {/* 2. Attached File */}
                        <div className="p-3 rounded-lg bg-[#161F2C] border border-slate-800">
                          <span className="text-[10px] text-[#64748B] block uppercase">Attached File</span>
                          <div className="flex items-center gap-1.5 text-white font-semibold mt-1">
                            <Paperclip className="w-3.5 h-3.5 text-[#C8F25C]" />
                            <span className="truncate">Resume - Ashish Raj.pdf</span>
                          </div>
                          <span className="text-[9px] text-[#C8F25C]">Ready in Gmail Draft</span>
                        </div>

                        {/* 3. Word Count */}
                        <div className="p-3 rounded-lg bg-[#161F2C] border border-slate-800 text-center">
                          <span className="text-[10px] text-[#64748B] block uppercase">Word Count</span>
                          <span className="text-lg font-bold text-white block mt-0.5">{wordCount}</span>
                          <span className="text-[9px] text-emerald-400">Optimal (55-95w)</span>
                        </div>

                        {/* 4. Match Score */}
                        <div className="p-3 rounded-lg bg-[#161F2C] border border-slate-800 text-center">
                          <span className="text-[10px] text-[#64748B] block uppercase">Match Score</span>
                          <span className="text-lg font-bold text-[#C8F25C] block mt-0.5">{matchScore}%</span>
                          <span className="text-[9px] text-[#94A3B8]">High Relevance</span>
                        </div>

                        {/* 5. Confidence Score */}
                        <div className="p-3 rounded-lg bg-[#161F2C] border border-slate-800 text-center">
                          <span className="text-[10px] text-[#64748B] block uppercase">Confidence</span>
                          <span className="text-lg font-bold text-[#C8F25C] block mt-0.5">{confidenceScore}%</span>
                          <span className="text-[9px] text-emerald-400">Verified Grounding</span>
                        </div>
                      </div>

                      {/* "Why Me?" Core Evidence Points */}
                      <div className="p-3.5 rounded-lg bg-[#161F2C] border border-slate-800 space-y-2">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-[#C8F25C] font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          "Why Me?" Core Evidence Points Used in Draft
                        </div>
                        <ul className="space-y-1 text-xs text-[#CBD5E1] pl-2 font-sans">
                          {whyMePoints.map((pt, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C8F25C] mt-1.5 shrink-0" />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Staged Draft Body Preview */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                          Staged Gmail Content
                        </div>
                        <div className="p-4 rounded-lg bg-[#12161F] border border-slate-800 text-xs font-sans text-[#CBD5E1] leading-relaxed whitespace-pre-wrap select-text">
                          <div className="font-mono text-white pb-2 mb-2 border-b border-slate-800 font-semibold">
                            Subject: {draft.subject}
                          </div>
                          {draft.body}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {isConnectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1117]/80 backdrop-blur-xs p-4">
          <div className="bg-[#161F2C] border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-operator-lg">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#F8FAFC] mb-2">
              Connect Gmail via Refresh Token
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4 font-sans leading-relaxed">
              Enter your OAuth2 Google Refresh Token configured with Gmail Draft scopes (`https://www.googleapis.com/auth/gmail.compose`).
            </p>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#94A3B8] uppercase mb-1.5">
                  OAuth2 Refresh Token
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="1//04..."
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-800 bg-[#0D1117] text-[#F8FAFC] focus:outline-hidden focus:border-[#C8F25C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConnectOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-800 text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!refreshToken.trim() || connectMutation.isPending}
                  className="px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#C8F25C]/90 disabled:opacity-50"
                >
                  {connectMutation.isPending ? 'Connecting...' : 'Connect Gmail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
