import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CircleDot,
  Mail,
  FileUser,
} from 'lucide-react';
import { gmailService } from '../services/gmailService';
import { resumeService } from '../services/resumeService';
import { systemService } from '../services/systemService';
import { FloatingDock } from '../components/navigation/FloatingDock';
import { CommandPalette } from '../components/command/CommandPalette';

export const AppLayout: React.FC = () => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Global shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: gmailStatus } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => gmailService.getStatus(),
    refetchInterval: 15000,
  });

  const { data: resumes } = useQuery({
    queryKey: ['resumes-list'],
    queryFn: () => resumeService.getAll(),
  });

  const { data: systemHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => systemService.getHealth(),
    refetchInterval: 30000,
  });

  const activeResume = resumes && resumes.length > 0 ? resumes[0] : null;

  const isHealthy =
    systemHealth?.status === 'ok' &&
    systemHealth?.services?.database === 'connected' &&
    systemHealth?.services?.redis === 'connected';

  return (
    <div className="relative flex h-screen w-screen bg-[#0D1117] text-[#F8FAFC] overflow-hidden font-sans select-none">
      {/* 21st.dev Faded Grid & Ambient Glow Layers (Linear / Arc style) */}
      <div className="absolute inset-0 bg-ambient-glow z-0" />
      <div className="absolute inset-0 bg-grid-faded z-0" />
      <div className="absolute inset-0 bg-noise-overlay z-0" />

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      {/* Left Navigation Rail (Aceternity Floating Dock) */}
      <aside className="relative z-10 w-16 border-r border-slate-800/80 bg-[#0D1117]/90 backdrop-blur-md flex flex-col items-center justify-between py-4 shrink-0">
        {/* Top Branding & Cmd+K Trigger */}
        <div className="flex flex-col items-center gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => setIsCommandOpen(true)}
            className="w-9 h-9 rounded-xl bg-[#161F2C] border border-slate-700/50 flex items-center justify-center cursor-pointer hover:border-[#C8F25C]/50 hover:bg-[#1E293B] transition-all group shadow-sm"
            title="Relay Decision Workstation (⌘K)"
          >
            <div className="w-2.5 h-2.5 rounded-xs bg-[#C8F25C] shadow-[0_0_8px_rgba(200,242,92,0.6)] group-hover:scale-110 transition-transform" />
          </div>

          {/* Cmd+K Button */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className="w-9 h-8 rounded-lg border border-slate-800 bg-[#161F2C] flex items-center justify-center text-[10px] font-mono text-[#94A3B8] hover:text-[#F8FAFC] hover:border-slate-700 transition-colors"
            title="Open Command Menu (⌘K)"
          >
            ⌘K
          </button>
        </div>

        {/* Center: 21st.dev Floating Dock Navigation */}
        <FloatingDock onOpenCommand={() => setIsCommandOpen(true)} />

        {/* Bottom Status Indicators */}
        <div className="flex flex-col items-center gap-2.5">
          {/* Active Candidate Resume Indicator */}
          <div
            className="group relative flex items-center justify-center"
            title={activeResume ? `Active Resume: ${activeResume.label || activeResume.originalFileName}` : 'No Active Resume'}
          >
            <div
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                activeResume
                  ? 'bg-[#161F2C] border-[#C8F25C]/40 text-[#C8F25C]'
                  : 'bg-[#161F2C] border-slate-800 text-[#64748B]'
              }`}
            >
              <FileUser className="w-3.5 h-3.5" />
            </div>

            <div className="pointer-events-none absolute left-full ml-3 hidden md:flex items-center z-50">
              <div className="whitespace-nowrap rounded-md border border-slate-700/60 bg-[#161F2C] px-2 py-1 text-xs font-mono text-[#F8FAFC] shadow-xl opacity-0 transition-opacity group-hover:opacity-100">
                {activeResume ? activeResume.label || activeResume.originalFileName : 'No Resume'}
              </div>
            </div>
          </div>

          {/* Connected Gmail Mailbox Indicator */}
          <div
            className="group relative flex items-center justify-center"
            title={gmailStatus?.connected ? `Gmail: ${gmailStatus.email}` : 'Gmail Disconnected'}
          >
            <div className="w-7 h-7 rounded-lg border border-slate-800 bg-[#161F2C] flex items-center justify-center relative">
              <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0D1117] ${
                  gmailStatus?.connected ? 'bg-[#A3E635] shadow-[0_0_6px_#A3E635]' : 'bg-[#EF4444]'
                }`}
              />
            </div>

            <div className="pointer-events-none absolute left-full ml-3 hidden md:flex items-center z-50">
              <div className="whitespace-nowrap rounded-md border border-slate-700/60 bg-[#161F2C] px-2 py-1 text-xs font-mono text-[#F8FAFC] shadow-xl opacity-0 transition-opacity group-hover:opacity-100">
                {gmailStatus?.connected ? gmailStatus.email : 'Gmail Disconnected'}
              </div>
            </div>
          </div>

          {/* System Health Pulse */}
          <div
            className="w-3 h-3 rounded-full flex items-center justify-center"
            title={isHealthy ? 'System Health: Operational' : 'System Health: Degraded'}
          >
            <CircleDot
              className={`w-2.5 h-2.5 ${
                isHealthy ? 'text-[#A3E635]' : 'text-[#FBBF24]'
              }`}
            />
          </div>
        </div>
      </aside>

      {/* Main Viewport Container with proper flex and scrolling */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0D1117]/60">
        <Outlet />
      </main>
    </div>
  );
};
