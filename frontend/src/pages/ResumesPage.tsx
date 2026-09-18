import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Upload,
  RefreshCw,
  Briefcase,
  Trophy,
  FolderGit2,
  Code2,
  Calendar,
  User,
  CheckCircle2,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { resumeService } from '../services/resumeService';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ResumeCategory } from '../types/resume';

export const ResumesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<ResumeCategory>('BACKEND');
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [showRawResume, setShowRawResume] = useState(false);

  // Fetch Resumes List
  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes-list'],
    queryFn: () => resumeService.getAll(),
  });

  const activeResumeId = selectedResumeId || (resumes && resumes.length > 0 ? resumes[0].id : null);

  // Fetch Active Resume Detail
  const { data: resumeDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['resume-detail', activeResumeId],
    queryFn: () => resumeService.getById(activeResumeId!),
    enabled: !!activeResumeId,
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { file: File; label?: string; category?: string }) =>
      resumeService.upload(data.file, data.label, data.category),
    onSuccess: (newResume) => {
      queryClient.invalidateQueries({ queryKey: ['resumes-list'] });
      setIsUploadOpen(false);
      setSelectedFile(null);
      setLabel('');
      setSelectedResumeId(newResume.id);
    },
  });

  // Re-parse Mutation
  const reparseMutation = useMutation({
    mutationFn: (id: string) => resumeService.reparse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes-list'] });
      queryClient.invalidateQueries({ queryKey: ['resume-detail', activeResumeId] });
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    uploadMutation.mutate({
      file: selectedFile,
      label: label.trim() || undefined,
      category,
    });
  };

  const profile = resumeDetail?.profile;
  const currentCategory = resumeDetail?.category || 'BACKEND';

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#12161F] text-white overflow-hidden font-sans">
      {/* Scrollable Container */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-12 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Multi-Resume Switcher Deck */}
          {resumes && resumes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-[#A8B3C7]">
                <span className="uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#C8F25C]" />
                  Available Candidate Resumes ({resumes.length})
                </span>
                <span className="text-[10px] text-[#64748B]">Click to switch view</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {resumes.map((r) => {
                  const isSelected = r.id === activeResumeId;
                  const cat = r.category || 'BACKEND';
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedResumeId(r.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-2.5 transition-all shrink-0 border ${
                        isSelected
                          ? 'bg-[#171C26] border-[#C8F25C] text-[#C8F25C] shadow-[0_0_12px_rgba(200,242,92,0.15)]'
                          : 'bg-[#171C26]/60 border-white/8 text-[#A8B3C7] hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-[#C8F25C]' : 'text-[#64748B]'}`} />
                      <span className="font-semibold font-sans">{r.label || r.originalFileName}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                          cat === 'AI_ML'
                            ? 'bg-purple-500/15 border border-purple-500/40 text-purple-300'
                            : cat === 'FULL_STACK'
                            ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300'
                            : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {cat}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. Resume Header */}
          <div className="p-6 rounded-xl border border-white/8 bg-[#171C26] shadow-operator flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#12161F] border border-white/8 text-[#C8F25C]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {profile?.name || resumeDetail?.label || 'Ashish Raj'}
                    </h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C8F25C]/15 border border-[#C8F25C]/40 text-[#C8F25C] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> ACTIVE RESUME
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/80 font-bold uppercase">
                      {currentCategory}
                    </span>
                  </div>
                  <div className="text-xs text-[#A8B3C7] font-mono mt-0.5">
                    {profile?.title || 'Software Engineer'} • {profile?.totalYearsExperience ?? 2}+ years experience
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {activeResumeId && (
                <button
                  onClick={() => reparseMutation.mutate(activeResumeId)}
                  disabled={reparseMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-white/8 bg-[#12161F] text-[#A8B3C7] hover:text-white transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reparseMutation.isPending ? 'animate-spin' : ''}`} />
                  Re-parse Resume
                </button>
              )}

              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#B8E24C] transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Resume PDF
              </button>
            </div>
          </div>

          {!profile && !isLoadingDetail ? (
            <EmptyState
              title="No resume parsed yet"
              description="Upload your engineering resume PDF so Relay can extract your professional experience timeline, key achievements, and technical projects."
              action={{
                label: 'Upload Resume PDF',
                onClick: () => setIsUploadOpen(true),
              }}
            />
          ) : (
            <>
              {/* 2. Experience Timeline (FIRST - Aceternity Timeline Pattern with Concrete Deliverables) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#C8F25C]" />
                    <h2 className="text-sm font-mono uppercase tracking-wider text-white font-semibold">
                      Experience Timeline
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-[#C8F25C] font-medium">
                    Deliverables • Scale & Ownership • Measurable Impact
                  </span>
                </div>

                {profile?.experience && profile.experience.length > 0 ? (
                  <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#2A3346]">
                    {profile.experience.map((exp, idx) => {
                      const sourceBullets = exp.sourceBullets || exp.highlights || [];
                      const whatWasBuilt = exp.whatWasBuilt || [];
                      const scaleAndOwnership = exp.scaleAndOwnership || [];
                      const measurableImpact = exp.measurableImpact || [];
                      const technologies = exp.technologies || [];

                      return (
                        <div key={idx} className="relative group">
                          {/* Timeline Node Dot */}
                          <div className="absolute -left-[27px] top-2 w-3.5 h-3.5 rounded-full bg-[#12161F] border-2 border-[#C8F25C] shadow-[0_0_8px_rgba(200,242,92,0.6)]" />

                          {/* Timeline Card */}
                          <div className="p-6 rounded-xl border border-white/8 bg-[#171C26] shadow-operator space-y-4 hover:border-white/16 transition-all">
                            {/* Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/6 pb-3">
                              <div>
                                <h3 className="text-base font-bold text-white font-sans">
                                  {exp.company}
                                </h3>
                                <div className="text-xs font-mono text-[#C8F25C] font-semibold mt-0.5">
                                  {exp.role || exp.title || 'Backend Engineer'}
                                </div>
                              </div>
                              {(exp.duration || (exp.startDate && exp.endDate)) && (
                                <span className="text-[11px] font-mono text-[#A8B3C7] flex items-center gap-1.5 self-start sm:self-auto bg-[#12161F] px-2.5 py-1 rounded-md border border-white/6">
                                  <Calendar className="w-3 h-3 text-[#64748B]" />
                                  {exp.duration || `${exp.startDate} - ${exp.endDate}`}
                                </span>
                              )}
                            </div>

                            {/* Source Bullets */}
                            {sourceBullets.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-mono uppercase tracking-wider text-[#A8B3C7] font-semibold flex items-center gap-1.5">
                                  <span>•</span>
                                  Key Responsibilities & Deliverables
                                </div>
                                <ul className="space-y-1.5 text-xs text-[#CBD5E1] pl-2">
                                  {sourceBullets.map((bullet, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#C8F25C] mt-1.5 shrink-0" />
                                      <span>{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* What Was Built */}
                            {whatWasBuilt.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                                  <Zap className="w-3.5 h-3.5" />
                                  What Was Built
                                </div>
                                <ul className="space-y-1 text-xs text-[#CBD5E1] pl-2">
                                  {whatWasBuilt.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Scale & Ownership */}
                            {scaleAndOwnership.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5" />
                                  Scale & Ownership
                                </div>
                                <ul className="space-y-1 text-xs text-[#CBD5E1] pl-2">
                                  {scaleAndOwnership.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Measurable Impact */}
                            {measurableImpact.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                                  <Trophy className="w-3.5 h-3.5" />
                                  Measurable Impact
                                </div>
                                <ul className="space-y-1 text-xs text-[#CBD5E1] pl-2">
                                  {measurableImpact.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Technology Tags */}
                            {technologies.length > 0 && (
                              <div className="pt-2 border-t border-white/6">
                                <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1.5">
                                  Technologies Used
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {technologies.map((t, i) => (
                                    <span
                                      key={i}
                                      className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#12161F] border border-white/8 text-[#A8B3C7] font-medium"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-white/8 bg-[#171C26] text-xs text-[#A8B3C7] italic">
                    No work experience parsed from this resume.
                  </div>
                )}
              </div>

              {/* 3. Achievements (SECOND) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/8 pb-3">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-mono uppercase tracking-wider text-white font-semibold">
                    Achievements
                  </h2>
                  <span className="text-xs font-mono text-[#64748B]">
                    (Secondary proof points)
                  </span>
                </div>

                {profile?.achievements && profile.achievements.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profile.achievements.map((ach, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-white/8 bg-[#171C26] text-xs text-white leading-relaxed flex items-start gap-2.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{ach}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-white/8 bg-[#171C26] text-xs text-[#A8B3C7] italic">
                    No explicit achievements parsed.
                  </div>
                )}
              </div>

              {/* 4. Projects (THIRD) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/8 pb-3">
                  <FolderGit2 className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-mono uppercase tracking-wider text-white font-semibold">
                    Projects
                  </h2>
                  <span className="text-xs font-mono text-[#64748B]">
                    (Technical proof points)
                  </span>
                </div>

                {profile?.projects && profile.projects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.projects.map((proj, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-xl border border-white/8 bg-[#171C26] space-y-2 hover:border-white/16 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold font-mono text-white">
                            {proj.name}
                          </h3>
                          {proj.role && (
                            <span className="text-[10px] font-mono text-[#64748B]">
                              {proj.role}
                            </span>
                          )}
                        </div>
                        {proj.description && (
                          <p className="text-xs text-[#A8B3C7] line-clamp-3 leading-relaxed font-sans">
                            {proj.description}
                          </p>
                        )}
                        {(proj.technologies || proj.techStack) && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(proj.technologies || proj.techStack || []).map((t, i) => (
                              <span
                                key={i}
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#12161F] border border-white/8 text-[#A8B3C7]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-white/8 bg-[#171C26] text-xs text-[#A8B3C7] italic">
                    No projects parsed.
                  </div>
                )}
              </div>

              {/* 5. Skills */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/8 pb-3">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-mono uppercase tracking-wider text-white font-semibold">
                    Skills Matrix
                  </h2>
                </div>

                <div className="p-5 rounded-xl border border-white/8 bg-[#171C26] space-y-4">
                  {profile?.skills && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {profile.skills.languages && profile.skills.languages.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1.5">Languages</div>
                          <div className="flex flex-wrap gap-1">
                            {profile.skills.languages.map((s, i) => (
                              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12161F] text-[#F8FAFC] border border-white/8">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.skills.frameworks && profile.skills.frameworks.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1.5">Frameworks</div>
                          <div className="flex flex-wrap gap-1">
                            {profile.skills.frameworks.map((s, i) => (
                              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12161F] text-[#F8FAFC] border border-white/8">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.skills.databases && profile.skills.databases.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1.5">Databases</div>
                          <div className="flex flex-wrap gap-1">
                            {profile.skills.databases.map((s, i) => (
                              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12161F] text-[#F8FAFC] border border-white/8">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.skills.tools && profile.skills.tools.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1.5">Tools & Infra</div>
                          <div className="flex flex-wrap gap-1">
                            {profile.skills.tools.map((s, i) => (
                              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12161F] text-[#F8FAFC] border border-white/8">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload Modal with Category Selector */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1115]/80 backdrop-blur-xs p-4">
          <div className="bg-[#171C26] border border-white/8 rounded-xl w-full max-w-md p-6 shadow-operator-lg space-y-4">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              Upload Resume PDF
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#A8B3C7] uppercase mb-1.5">
                  Resume File (PDF)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  ref={fileInputRef}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs font-mono file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-mono file:bg-[#C8F25C] file:text-black hover:file:bg-[#B8E24C] text-[#A8B3C7]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#A8B3C7] uppercase mb-1.5">
                  Label (e.g. Backend Resume 2026)
                </label>
                <input
                  type="text"
                  placeholder="Backend Engineer Profile"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-white/8 bg-[#12161F] text-white focus:outline-hidden focus:border-[#C8F25C] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#A8B3C7] uppercase mb-1.5">
                  Resume Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ResumeCategory)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-white/8 bg-[#12161F] text-white focus:outline-hidden focus:border-[#C8F25C] font-mono"
                >
                  <option value="BACKEND">BACKEND (Distributed Systems, APIs, Queues, DBs)</option>
                  <option value="AI_ML">AI_ML (PyTorch, LLMs, Vector DBs, Agents)</option>
                  <option value="FULL_STACK">FULL_STACK (React, Node, TypeScript, End-to-End)</option>
                  <option value="CUSTOM">CUSTOM (General Purpose / Specialized)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/8">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg border border-white/8 text-[#A8B3C7] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg border border-[#C8F25C]/40 bg-[#C8F25C] text-black hover:bg-[#B8E24C] disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload & Parse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
