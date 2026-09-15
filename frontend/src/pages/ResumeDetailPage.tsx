import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  User,
  Briefcase,
  GraduationCap,
  Code2,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  Mail,
  MapPin,
  Calendar,
} from 'lucide-react';
import { resumeService } from '../services/resumeService';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';

export const ResumeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRawText, setShowRawText] = useState(false);

  const { data: resume, isLoading, refetch } = useQuery({
    queryKey: ['resume', id],
    queryFn: () => resumeService.getById(id!),
    enabled: !!id,
  });

  const reparseMutation = useMutation({
    mutationFn: () => resumeService.reparse(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', id] });
      queryClient.invalidateQueries({ queryKey: ['resumes-list'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-relay-muted font-mono text-xs">
        Loading parsed resume profile...
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-relay-muted font-mono text-xs">Resume not found.</p>
        <button
          onClick={() => navigate('/resumes')}
          className="px-3 py-1.5 text-xs font-mono rounded border border-relay-border text-relay-text hover:bg-relay-card"
        >
          Return to Resumes
        </button>
      </div>
    );
  }

  const profile = resume.profile;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Back Link */}
      <button
        onClick={() => navigate('/resumes')}
        className="flex items-center gap-1.5 text-xs font-mono text-relay-muted hover:text-relay-text transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Candidate Resumes</span>
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono tracking-tight text-relay-text flex items-center gap-2">
              <FileText className="w-5 h-5 text-relay-accent" />
              {resume.label || profile?.name || resume.originalFileName}
            </h1>
            <StatusBadge status={resume.status} size="sm" />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-relay-muted">
            <span className="text-relay-text">{resume.originalFileName}</span>
            <span className="text-relay-border">•</span>
            <span>Uploaded: {new Date(resume.uploadedAt).toLocaleDateString()}</span>
            {profile?.totalYearsExperience !== undefined && profile.totalYearsExperience !== null && (
              <>
                <span className="text-relay-border">•</span>
                <span>{profile.totalYearsExperience} years experience</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => reparseMutation.mutate()}
            disabled={reparseMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-relay-border bg-relay-bg text-relay-text hover:bg-relay-card-hover disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reparseMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Re-parse Resume</span>
          </button>
        </div>
      </div>

      {!profile ? (
        <EmptyState
          title="Profile not parsed yet"
          description={
            resume.parseError
              ? `Parse Error: ${resume.parseError}`
              : "This resume has not been converted to a structured candidate profile."
          }
          action={{
            label: "Trigger Re-parse",
            onClick: () => reparseMutation.mutate(),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Columns: Summary, Experience, Projects */}
          <div className="lg:col-span-2 space-y-6">
            {/* Candidate Summary */}
            {profile.summary && (
              <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-relay-muted font-semibold">
                  Professional Summary
                </span>
                <p className="text-xs text-relay-text leading-relaxed font-sans">
                  {profile.summary}
                </p>
              </div>
            )}

            {/* Work Experience */}
            <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-relay-border">
                <span className="text-[11px] font-mono uppercase tracking-wider text-relay-muted font-semibold flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-relay-accent" />
                  Work Experience
                </span>
                <span className="text-[10px] font-mono text-relay-subtle">
                  {profile.experience?.length || 0} positions
                </span>
              </div>

              <div className="space-y-5">
                {profile.experience && profile.experience.length > 0 ? (
                  profile.experience.map((exp, i) => (
                    <div key={i} className="space-y-1.5 border-l-2 border-relay-border pl-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-relay-text">{exp.role}</span>
                        {exp.duration && (
                          <span className="text-[10px] font-mono text-relay-subtle flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {exp.duration}
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-relay-accent">{exp.company}</div>

                      {exp.description && (
                        <p className="text-xs text-relay-muted leading-relaxed font-sans pt-1">
                          {exp.description}
                        </p>
                      )}

                      {exp.technologies && exp.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {exp.technologies.map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-subtle"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-relay-subtle italic">No work experience entries parsed.</div>
                )}
              </div>
            </div>

            {/* Key Projects */}
            <div className="p-6 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-relay-border">
                <span className="text-[11px] font-mono uppercase tracking-wider text-relay-muted font-semibold flex items-center gap-1.5">
                  <FolderGit2 className="w-4 h-4 text-purple-400" />
                  Key Projects & Engineering Proof Points
                </span>
                <span className="text-[10px] font-mono text-relay-subtle">
                  Used for cold email achievement hooks
                </span>
              </div>

              <div className="space-y-4">
                {profile.projects && profile.projects.length > 0 ? (
                  profile.projects.map((proj, i) => (
                    <div key={i} className="p-3.5 rounded bg-relay-bg border border-relay-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-relay-text">
                          {proj.name}
                        </span>
                        {proj.role && (
                          <span className="text-[10px] font-mono text-relay-subtle">
                            {proj.role}
                          </span>
                        )}
                      </div>

                      {proj.impact ? (
                        <p className="text-xs text-relay-accent font-medium leading-relaxed font-sans">
                          {proj.impact}
                        </p>
                      ) : proj.description ? (
                        <p className="text-xs text-relay-muted leading-relaxed font-sans">
                          {proj.description}
                        </p>
                      ) : null}

                      {proj.technologies && proj.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {proj.technologies.map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-card border border-relay-border text-relay-subtle"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-relay-subtle italic">No projects parsed.</div>
                )}
              </div>
            </div>

            {/* Collapsible Raw Text */}
            <div className="rounded-lg border border-relay-border bg-relay-card shadow-operator overflow-hidden">
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="w-full p-4 flex items-center justify-between text-xs font-mono font-medium text-relay-muted hover:text-relay-text hover:bg-relay-card-hover transition-colors"
              >
                <span>Inspect Extracted Raw Text</span>
                {showRawText ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {showRawText && (
                <div className="p-4 border-t border-relay-border bg-relay-bg font-mono text-[11px] max-h-80 overflow-y-auto leading-relaxed text-relay-muted whitespace-pre-wrap">
                  {resume.rawText || 'No raw text extracted.'}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Skills, Candidate Info, Education */}
          <div className="space-y-6">
            {/* Candidate Metadata */}
            <div className="p-5 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-relay-accent" />
                Candidate Identity
              </span>

              <div className="space-y-2 text-xs">
                {profile.name && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle block">Full Name</span>
                    <span className="text-relay-text font-medium">{profile.name}</span>
                  </div>
                )}
                {profile.title && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle block">Professional Title</span>
                    <span className="text-relay-text">{profile.title}</span>
                  </div>
                )}
                {profile.email && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle block">Email</span>
                    <span className="font-mono text-relay-muted select-all">{profile.email}</span>
                  </div>
                )}
                {profile.location && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle block">Location</span>
                    <span className="text-relay-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {profile.location}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills Categorized */}
            <div className="p-5 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-relay-accent" />
                Parsed Skill Graph
              </span>

              <div className="space-y-3">
                {profile.skills?.languages && profile.skills.languages.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">Languages</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.languages.map((s, i) => (
                        <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.skills?.frameworks && profile.skills.frameworks.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">Frameworks</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.frameworks.map((s, i) => (
                        <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.skills?.databases && profile.skills.databases.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">Databases</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.databases.map((s, i) => (
                        <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.skills?.cloud && profile.skills.cloud.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono text-relay-subtle uppercase block mb-1">Cloud / Infra</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.cloud.map((s, i) => (
                        <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-relay-bg border border-relay-border text-relay-text">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Education */}
            {profile.education && profile.education.length > 0 && (
              <div className="p-5 rounded-lg border border-relay-border bg-relay-card shadow-operator space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-relay-muted font-semibold flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-relay-accent" />
                  Education
                </span>

                <div className="space-y-2">
                  {profile.education.map((edu, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="font-medium text-relay-text">{edu.institution}</div>
                      <div className="text-relay-muted font-mono text-[11px]">
                        {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                      </div>
                      {edu.graduationYear && (
                        <div className="text-[10px] font-mono text-relay-subtle">
                          Class of {edu.graduationYear}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
