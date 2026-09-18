import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  Briefcase,
  Trophy,
  FolderGit2,
  Code2,
  Calendar,
  User,
  Zap,
  Layers,
} from 'lucide-react';
import { resumeService } from '../services/resumeService';
import { StatusBadge } from '../components/common/StatusBadge';

export const ResumeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: resumeDetail, isLoading } = useQuery({
    queryKey: ['resume-detail', id],
    queryFn: () => resumeService.getById(id!),
    enabled: !!id,
  });

  const reparseMutation = useMutation({
    mutationFn: () => resumeService.reparse(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['resumes-list'] });
    },
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-[#A8B3C7] font-mono text-xs bg-[#12161F]">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#C8F25C]" />
          Loading candidate resume profile...
        </div>
      </div>
    );
  }

  if (!resumeDetail) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-4 bg-[#12161F]">
        <p className="text-[#A8B3C7] font-mono text-xs">Resume record not found.</p>
        <button
          onClick={() => navigate('/resumes')}
          className="px-3.5 py-1.5 text-xs font-mono rounded-md border border-white/8 bg-[#171C26] text-white hover:bg-[#202735] transition-colors"
        >
          Return to Resumes
        </button>
      </div>
    );
  }

  const profile = resumeDetail.profile;
  const category = resumeDetail.category || 'BACKEND';

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#12161F] text-white overflow-hidden font-sans">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-12 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Back button */}
          <button
            onClick={() => navigate('/resumes')}
            className="self-start flex items-center gap-1.5 text-xs font-mono text-[#A8B3C7] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Resumes</span>
          </button>

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
                      {profile?.name || resumeDetail.label || 'Candidate Profile'}
                    </h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C8F25C]/15 border border-[#C8F25C]/40 text-[#C8F25C] font-semibold">
                      {category}
                    </span>
                    <StatusBadge status={resumeDetail.status} size="sm" />
                  </div>
                  <div className="text-xs text-[#A8B3C7] font-mono mt-0.5">
                    {profile?.title || 'Software Engineer'} • {profile?.totalYearsExperience ?? 2}+ years experience
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => reparseMutation.mutate()}
              disabled={reparseMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-md border border-white/8 bg-[#12161F] text-white hover:border-[#C8F25C]/50 hover:text-[#C8F25C] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reparseMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Re-Parse Resume</span>
            </button>
          </div>

          {/* 2. Experience Timeline (FIRST - Concrete Deliverables Pattern) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2A3346]">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#C8F25C]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Work Experience Timeline
                </h2>
              </div>
              <span className="text-xs font-mono text-[#C8F25C]">
                Deliverables • Scale & Ownership • Measurable Impact
              </span>
            </div>

            {profile?.experience && profile.experience.length > 0 ? (
              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#2A3346]">
                {profile.experience.map((exp, idx) => {
                  const sourceBullets =
                    exp.sourceBullets && exp.sourceBullets.length > 0
                      ? exp.sourceBullets
                      : exp.highlights || [];
                  const whatWasBuilt = exp.whatWasBuilt || [];
                  const scaleAndOwnership = exp.scaleAndOwnership || [];
                  const measurableImpact = exp.measurableImpact || [];
                  const technologies = exp.technologies || [];

                  return (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-6 top-2 w-3.5 h-3.5 rounded-full border-2 border-[#C8F25C] bg-[#12161F] shadow-[0_0_8px_rgba(200,242,92,0.6)]" />

                      <div className="p-6 rounded-xl border border-white/8 bg-[#171C26] shadow-operator space-y-4 hover:border-[#C8F25C]/30 transition-all">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/6 pb-3">
                          <div>
                            <span className="font-bold text-base text-white">{exp.company}</span>
                            <span className="text-[#C8F25C] font-mono text-xs ml-2 font-semibold">
                              @ {exp.role || exp.title || 'Engineer'}
                            </span>
                          </div>
                          {(exp.duration || (exp.startDate && exp.endDate)) && (
                            <span className="text-xs font-mono text-[#A8B3C7] flex items-center gap-1 bg-[#12161F] px-2.5 py-1 rounded-md border border-white/6">
                              <Calendar className="w-3 h-3" />
                              {exp.duration || `${exp.startDate} - ${exp.endDate}`}
                            </span>
                          )}
                        </div>

                        {/* Source Bullets / Highlights */}
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

                        {/* Technologies */}
                        {technologies.length > 0 && (
                          <div className="pt-2 border-t border-white/6">
                            <div className="text-[10px] font-mono text-[#64748B] uppercase mb-1.5">
                              Technologies
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {technologies.map((t, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12161F] border border-white/8 text-[#A8B3C7]"
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
                No work experience recorded.
              </div>
            )}
          </div>

          {/* 3. Achievements (SECOND) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#2A3346]">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                Key Achievements
              </h2>
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
                No achievements recorded.
              </div>
            )}
          </div>

          {/* 4. Projects (THIRD) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#2A3346]">
              <FolderGit2 className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                Engineering Projects
              </h2>
            </div>

            {profile?.projects && profile.projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.projects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl border border-white/8 bg-[#171C26] space-y-2 hover:border-white/16 transition-colors"
                  >
                    <h3 className="text-xs font-bold font-mono text-white">
                      {proj.name}
                    </h3>
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
                No projects recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
