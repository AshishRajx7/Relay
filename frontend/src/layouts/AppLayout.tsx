import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Layers,
  FileText,
  Building2,
  FileUser,
  Mail,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  CircleDot,
} from 'lucide-react';
import { gmailService } from '../services/gmailService';
import { resumeService } from '../services/resumeService';
import { systemService } from '../services/systemService';

export const AppLayout: React.FC = () => {
  const location = useLocation();

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

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/campaigns', label: 'Campaigns', icon: Layers },
    { to: '/drafts', label: 'Draft Queue', icon: FileText },
    { to: '/companies', label: 'Companies', icon: Building2 },
    { to: '/resumes', label: 'Resumes', icon: FileUser },
    { to: '/gmail', label: 'Gmail', icon: Mail },
    { to: '/settings', label: 'Settings', icon: Sliders },
  ];

  const isHealthy =
    systemHealth?.status === 'ok' &&
    systemHealth?.services?.database === 'connected' &&
    systemHealth?.services?.redis === 'connected';

  return (
    <div className="flex h-screen w-screen bg-relay-bg text-relay-text overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-relay-border bg-[#060B14] flex flex-col flex-shrink-0 select-none">
        {/* Logo / Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-relay-border">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-relay-accent" />
            <span className="font-mono font-bold tracking-wider text-sm text-relay-text">
              RELAY
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-relay-border text-relay-muted">
            OS v7.0
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === '/dashboard'
                ? location.pathname === '/' || location.pathname === '/dashboard'
                : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium tracking-wide transition-colors ${
                  isActive
                    ? 'bg-relay-card text-relay-text border border-relay-border shadow-sm'
                    : 'text-relay-muted hover:text-relay-text hover:bg-relay-card/40'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-relay-accent' : 'text-relay-muted'
                  }`}
                />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Sidebar Status */}
        <div className="p-3 border-t border-relay-border space-y-2 text-xs bg-[#080E1A]">
          {/* Connected Gmail */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-relay-card border border-relay-border">
            <div className="flex items-center gap-2 overflow-hidden">
              <Mail className="w-3.5 h-3.5 text-relay-muted flex-shrink-0" />
              <span className="text-[11px] truncate text-relay-muted">
                {gmailStatus?.connected && gmailStatus?.email
                  ? gmailStatus.email
                  : 'Gmail Disconnected'}
              </span>
            </div>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                gmailStatus?.connected ? 'bg-relay-success' : 'bg-relay-danger'
              }`}
            />
          </div>

          {/* Active Resume */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-relay-card border border-relay-border">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileUser className="w-3.5 h-3.5 text-relay-muted flex-shrink-0" />
              <span className="text-[11px] truncate text-relay-muted">
                {activeResume ? activeResume.label || activeResume.originalFileName : 'No Resume Active'}
              </span>
            </div>
            {activeResume && (
              <span className="text-[9px] font-mono px-1 rounded bg-relay-accent-muted text-relay-accent border border-relay-accent/30">
                ACTIVE
              </span>
            )}
          </div>

          {/* System Status */}
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-relay-subtle">
            <span className="flex items-center gap-1.5">
              <CircleDot
                className={`w-3 h-3 ${
                  isHealthy ? 'text-relay-success' : 'text-relay-warning'
                }`}
              />
              System Status
            </span>
            <span className="font-mono text-[10px] uppercase text-relay-muted">
              {isHealthy ? 'Operational' : 'Degraded'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col min-w-0 bg-relay-bg overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
