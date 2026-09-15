import React, { useState, useEffect } from 'react';
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

  // V7 Outreach guidelines:
  // Target: 65-80 words
  // Acceptable: 55-90 words
  // Hard max: 95 words
  const isTarget = wordCount >= 65 && wordCount <= 80;
  const isAcceptable = wordCount >= 55 && wordCount <= 90;
  const isTooLong = wordCount > 95;
  const isTooShort = wordCount < 45 && wordCount > 0;

  let wordCountColor = 'text-relay-muted';
  let wordCountBadge = 'bg-relay-bg text-relay-muted border-relay-border';

  if (isTarget) {
    wordCountColor = 'text-relay-accent font-semibold';
    wordCountBadge = 'bg-relay-accent/10 text-relay-accent border-relay-accent/30';
  } else if (isAcceptable) {
    wordCountColor = 'text-relay-text';
    wordCountBadge = 'bg-relay-card text-relay-text border-relay-border';
  } else if (isTooLong || isTooShort) {
    wordCountColor = 'text-amber-400 font-semibold';
    wordCountBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }

  return (
    <div className="h-full flex flex-col bg-relay-bg">
      {/* Top Editor Bar */}
      <div className="px-6 py-3.5 border-b border-relay-border flex items-center justify-between bg-relay-card/40">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-relay-muted" />
          <span className="text-xs font-mono font-medium text-relay-text">
            Draft Editor
          </span>
          <span className="text-[10px] font-mono text-relay-subtle">
            (Markdown / Plain-text)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status */}
          <div className="text-[11px] font-mono flex items-center gap-1.5">
            {isSaving ? (
              <span className="text-relay-accent animate-pulse">Saving...</span>
            ) : justSaved ? (
              <span className="text-relay-success flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            ) : isDirty ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Unsaved changes
              </span>
            ) : (
              <span className="text-relay-subtle">Saved to database</span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded border border-relay-border bg-relay-card text-relay-text hover:bg-relay-card-hover hover:border-relay-border-light disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Save changes (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>

      {/* Editor Main Content */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden space-y-4">
        {/* Subject Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-wider text-relay-subtle">
              Subject Line
            </label>
            <span className="text-[10px] font-mono text-relay-subtle">
              {subject.length} chars
            </span>
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            placeholder="Draft subject..."
            className="w-full px-3.5 py-2.5 text-sm font-medium rounded border border-relay-border bg-relay-card text-relay-text focus:outline-hidden focus:border-relay-accent font-sans transition-colors"
          />
        </div>

        {/* Body Textarea */}
        <div className="flex-1 flex flex-col space-y-1.5 min-h-0">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-wider text-relay-subtle">
              Email Body
            </label>
            <span className="text-[10px] font-mono text-relay-subtle">
              Standard 4-Paragraph Human Layout
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder="Draft body content..."
            className="flex-1 w-full p-4 text-xs font-mono leading-relaxed rounded border border-relay-border bg-relay-card text-relay-text focus:outline-hidden focus:border-relay-accent resize-none transition-colors"
          />
        </div>
      </div>

      {/* Bottom Footer Stats */}
      <div className="px-6 py-2.5 border-t border-relay-border bg-relay-card/40 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-relay-subtle">Word Count:</span>
          <span className={`px-2 py-0.5 rounded border text-[11px] font-mono ${wordCountBadge}`}>
            {wordCount} words
          </span>
          <span className="text-[10px] text-relay-subtle">
            (Target: 65–80 | Hard max: 95)
          </span>
        </div>

        <div className="text-[10px] text-relay-subtle">
          Press <kbd className="px-1 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-muted">Ctrl+S</kbd> to save
        </div>
      </div>
    </div>
  );
};
