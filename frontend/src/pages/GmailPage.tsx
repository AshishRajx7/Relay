import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Send,
  ArrowRight,
  LogOut,
  Key,
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

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-relay-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-relay-text flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-relay-accent" />
            Gmail Integration & Handoff
          </h1>
          <p className="text-xs text-relay-muted mt-1">
            Human-controlled outreach delivery. Relay creates drafts directly in your connected Gmail account for final review and sending.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchStatus()}
            className="p-2 text-xs rounded border border-relay-border text-relay-muted hover:text-relay-text bg-relay-card transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-mono font-semibold text-relay-text">
                Connection Status:
              </span>
              {status?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono bg-relay-success/15 border border-relay-success/30 text-relay-success font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono bg-relay-danger/15 border border-relay-danger/30 text-relay-danger font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  Disconnected
                </span>
              )}
            </div>

            {status?.connected && (
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-relay-muted pt-1">
                <span className="text-relay-text font-medium">{status.email || profile?.emailAddress}</span>
                {status.connectedAt && (
                  <>
                    <span className="text-relay-border">•</span>
                    <span>Connected on {new Date(status.connectedAt).toLocaleDateString()}</span>
                  </>
                )}
                {profile && (
                  <>
                    <span className="text-relay-border">•</span>
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-relay-danger/40 bg-relay-danger/10 text-relay-danger hover:bg-relay-danger/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => setIsConnectOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover transition-colors shadow-operator"
              >
                <Key className="w-3.5 h-3.5" />
                Connect Gmail Account
              </button>
            )}
          </div>
        </div>

        {/* Security & Relay Handoff Philosophy */}
        <div className="mt-5 pt-4 border-t border-relay-border/60 flex items-start gap-2.5 text-xs text-relay-muted">
          <ShieldCheck className="w-4 h-4 text-relay-accent shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Relay Policy:</strong> Relay will NEVER autonomously send emails. It only calls Gmail API to generate drafts in your draft folder with candidate resume attached. You retain complete sovereignty to review, edit, and click Send inside Gmail.
          </p>
        </div>
      </div>

      {/* Synced Drafts Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-relay-text font-bold flex items-center gap-2">
            <Send className="w-4 h-4 text-relay-accent" />
            Created Gmail Drafts ({syncedDrafts?.length || 0})
          </span>
          <span className="text-[11px] font-mono text-relay-subtle">
            Drafts staged in your Gmail mailbox
          </span>
        </div>

        {isDraftsLoading ? (
          <div className="flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
            Loading synced Gmail drafts...
          </div>
        ) : !syncedDrafts || syncedDrafts.length === 0 ? (
          <EmptyState
            title="No Gmail drafts created"
            description="Approved drafts that are synchronized to your Gmail account will appear here with their Gmail Draft IDs."
            action={{
              label: "Open Draft Queue",
              onClick: () => navigate('/drafts'),
            }}
          />
        ) : (
          <div className="rounded-lg border border-relay-border bg-relay-card overflow-hidden shadow-operator">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-relay-border bg-relay-bg/60 font-mono text-[11px] text-relay-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Target Company</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Gmail Draft ID</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-relay-border/60">
                {syncedDrafts.map((draft) => (
                  <tr
                    key={draft.id}
                    onClick={() => navigate(`/drafts/${draft.id}`)}
                    className="hover:bg-relay-card-hover/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono text-relay-text">
                      {draft.prospect?.email}
                    </td>
                    <td className="py-3 px-4 font-mono text-relay-muted">
                      {draft.prospect?.companyName || '—'}
                    </td>
                    <td className="py-3 px-4 font-sans text-relay-muted truncate max-w-xs">
                      {draft.subject}
                    </td>
                    <td className="py-3 px-4 font-mono text-relay-accent text-[11px]">
                      {draft.gmailDraftId || '—'}
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
                        Workspace
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {isConnectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-relay-card border border-relay-border rounded-lg w-full max-w-md p-6 shadow-operator-lg">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-relay-text mb-2">
              Connect Gmail via Refresh Token
            </h3>
            <p className="text-xs text-relay-muted mb-4 font-sans leading-relaxed">
              Enter your OAuth2 Google Refresh Token configured with Gmail Draft scopes (`https://www.googleapis.com/auth/gmail.compose`).
            </p>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-relay-muted uppercase mb-1.5">
                  OAuth2 Refresh Token
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="1//04..."
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded border border-relay-border bg-relay-bg text-relay-text focus:outline-hidden focus:border-relay-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-relay-border">
                <button
                  type="button"
                  onClick={() => setIsConnectOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded border border-relay-border text-relay-muted hover:text-relay-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!refreshToken.trim() || connectMutation.isPending}
                  className="px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 bg-relay-accent text-black hover:bg-relay-accent-hover disabled:opacity-50"
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
