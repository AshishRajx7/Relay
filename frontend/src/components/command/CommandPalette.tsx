import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import {
  Inbox,
  GitPullRequest,
  Building2,
  FileCode2,
  Send,
  Sliders,
  FileText,
  Search,
} from 'lucide-react';
import { draftService } from '../../services/draftService';
import { companyService } from '../../services/companyService';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch items to search inside palette
  const { data: drafts } = useQuery({
    queryKey: ['palette-drafts'],
    queryFn: () => draftService.getAll(),
    enabled: isOpen,
  });

  const { data: companies } = useQuery({
    queryKey: ['palette-companies'],
    queryFn: () => companyService.getAll(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-[#0D1117]/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl rounded-xl border border-slate-700/60 bg-[#161F2C] shadow-2xl overflow-hidden z-10 font-sans">
        <Command label="Relay Decision Workstation Commands" className="w-full">
          {/* Search Input */}
          <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-[#0D1117]/60">
            <Search className="w-4 h-4 text-[#64748B] mr-2.5 shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Search companies, review queue, commands..."
              className="w-full text-xs font-mono bg-transparent text-[#F8FAFC] placeholder:text-[#64748B] outline-none"
            />
            <kbd className="px-1.5 py-0.5 rounded bg-[#161F2C] border border-slate-800 text-[10px] font-mono text-[#64748B]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
            <Command.Empty className="py-8 text-center text-xs font-mono text-[#64748B]">
              No matching records or actions found.
            </Command.Empty>

            {/* Workflows Navigation */}
            <Command.Group heading="Navigation Workflows" className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#64748B]">
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/'))}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-[#C8F25C]" />
                  <span className="font-medium">Company Directory (Entry Point)</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">G C</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate('/queue'))}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Inbox className="w-4 h-4 text-[#C8F25C]" />
                  <span className="font-medium">Review Queue</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">G Q</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate('/campaigns'))}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <GitPullRequest className="w-4 h-4 text-[#C8F25C]" />
                  <span className="font-medium">Campaign Pipelines (CI/CD)</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">G P</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate('/resumes'))}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode2 className="w-4 h-4 text-[#C8F25C]" />
                  <span className="font-medium">Candidate Resume & Experience</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">G R</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate('/gmail'))}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-[#C8F25C]" />
                  <span className="font-medium">Gmail Mailbox & Staged Drafts</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">G G</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate('/settings'))}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-[#94A3B8]" />
                  <span className="font-medium">Settings & Telemetry</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B]">G S</span>
              </Command.Item>
            </Command.Group>

            {/* Jump to Drafts */}
            {drafts && drafts.length > 0 && (
              <Command.Group heading="Drafts in Queue" className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#64748B]">
                {drafts.slice(0, 6).map((d) => (
                  <Command.Item
                    key={d.id}
                    onSelect={() => handleSelect(() => navigate(`/drafts/${d.id}`))}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span className="font-medium text-[#F8FAFC]">
                        {d.prospect?.companyName || 'Target'}:
                      </span>
                      <span className="text-[#94A3B8] truncate max-w-xs">
                        {d.subject || 'Draft ready for review'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#C8F25C]">
                      {d.quality?.confidenceScore ? `${d.quality.confidenceScore}%` : 'REVIEW'}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Jump to Target Companies */}
            {companies && companies.length > 0 && (
              <Command.Group heading="Target Companies" className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#64748B]">
                {companies.slice(0, 6).map((c) => (
                  <Command.Item
                    key={c.id}
                    onSelect={() => handleSelect(() => navigate(`/companies/${c.id}`))}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-[#F8FAFC] hover:bg-[#1E293B] hover:text-[#C8F25C] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span className="font-medium text-[#F8FAFC]">{c.name}</span>
                      <span className="text-[11px] font-mono text-[#64748B]">
                        ({c.normalizedDomain})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#64748B]">
                      {c.contactCount} contacts
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="px-4 py-2 border-t border-slate-800 bg-[#0D1117]/60 flex items-center justify-between text-[11px] font-mono text-[#64748B]">
            <span>Navigate: ↑↓</span>
            <span>Select: ↵</span>
            <span>Close: Esc</span>
          </div>
        </Command>
      </div>
    </div>
  );
};
