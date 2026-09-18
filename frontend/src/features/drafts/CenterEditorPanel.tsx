import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Check, AlertTriangle, FileText } from 'lucide-react';
import { EmailDraft } from '../../types/draft';

interface CenterEditorPanelProps {
  draft: EmailDraft;
  onSave: (subject: string, body: string) => Promise<void>;
  isSaving: boolean;
}

export const CenterEditorPanel: React.FC<CenterEditorPanelProps> = ({
  draft,
  onSave,
  isSaving,
}) => {
  const [subject, setSubject] = useState(draft.subject || '');
  const [body, setBody] = useState(draft.body || '');
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Sync state if draft prop changes (e.g. after variant select or regenerate)
  useEffect(() => {
    setSubject(draft.subject || '');
    setBody(draft.body || '');
    setIsDirty(false);
  }, [draft.id, draft.subject, draft.body]);

  const handleSubjectChange = (val: string) => {
    setSubject(val);
    setIsDirty(true);
    setJustSaved(false);
  };

  const handleBodyChange = (val: string) => {
    setBody(val);
    setIsDirty(true);
    setJustSaved(false);
  };

  const handleSave = async () => {
    await onSave(subject, body);
    setIsDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  // Keyboard shortcut Ctrl+S or Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, subject, body]);

  // Word count calculation
  const words = body
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = words.length;

  const isTarget = wordCount >= 65 && wordCount <= 80;
  const isAcceptable = wordCount >= 55 && wordCount <= 90;
  const isTooLong = wordCount > 95;
  const isTooShort = wordCount < 45 && wordCount > 0;

  let wordCountBadge = 'bg-[#0D1117] text-[#94A3B8] border-slate-800';

  if (isTarget) {
    wordCountBadge = 'bg-[#C8F25C]/15 text-[#C8F25C] border-[#C8F25C]/40 font-semibold';
  } else if (isAcceptable) {
    wordCountBadge = 'bg-[#1E293B] text-[#F8FAFC] border-slate-700/60';
  } else if (isTooLong || isTooShort) {
    wordCountBadge = 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-semibold';
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0D1117]">
      {/* Top Editor Bar */}
      <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-[#161F2C]/90 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#C8F25C]" />
          <span className="text-xs font-mono font-medium text-[#F8FAFC]">
            Email Editor
          </span>
          <span className="text-[10px] font-mono text-[#64748B]">
            (Human Engineer Voice)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status Feedback */}
          <div className="text-[11px] font-mono flex items-center gap-1.5">
            {isSaving ? (
              <span className="text-[#C8F25C] animate-pulse">Saving...</span>
            ) : justSaved ? (
              <motion.span
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[#C8F25C] flex items-center gap-1 font-medium"
              >
                <Check className="w-3.5 h-3.5" /> Saved
              </motion.span>
            ) : isDirty ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Unsaved
              </span>
            ) : (
              <span className="text-[#64748B]">Saved to DB</span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg border border-slate-700/60 bg-[#1E293B] text-[#F8FAFC] hover:border-[#C8F25C]/50 hover:text-[#C8F25C] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            title="Save changes (Ctrl+S / ⌘S)"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>

      {/* Editor Main Content */}
      <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Subject Line */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#64748B]">
              Subject Line
            </label>
            <span className="text-[10px] font-mono text-[#64748B]">
              {subject.length} chars
            </span>
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            placeholder="Subject line..."
            className="w-full px-3.5 py-2.5 text-sm font-medium rounded-lg border border-slate-800 bg-[#161F2C] text-[#F8FAFC] focus:outline-hidden focus:border-[#C8F25C] font-sans transition-colors"
          />
        </div>

        {/* Body Textarea with JetBrains Mono */}
        <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#64748B]">
              Email Body (4-Paragraph Human Layout)
            </label>
            <span className="text-[10px] font-mono text-[#64748B]">
              No sales buzzwords • Attached PDF resume
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder="Email body text..."
            className="flex-1 min-h-0 w-full p-4 text-xs font-mono leading-relaxed rounded-lg border border-slate-800 bg-[#161F2C] text-[#F8FAFC] focus:outline-hidden focus:border-[#C8F25C] resize-none transition-colors"
          />
        </div>
      </div>

      {/* Bottom Footer Telemetry */}
      <div className="px-5 py-2.5 border-t border-slate-800 bg-[#161F2C]/90 flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#64748B]">Word Count:</span>
          <span className={`px-2 py-0.5 rounded-md border text-[11px] font-mono ${wordCountBadge}`}>
            {wordCount} words
          </span>
          <span className="text-[10px] text-[#64748B]">
            (Target: 65–80 | Hard max: 95)
          </span>
        </div>

        <div className="text-[10px] text-[#64748B] flex items-center gap-2">
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#0D1117] border border-slate-800 text-[#94A3B8]">
            ⌘S
          </kbd>
          <span>to save</span>
        </div>
      </div>
    </div>
  );
};
