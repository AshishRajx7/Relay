export type ResumeFileStatus = 'PENDING' | 'PARSED' | 'FAILED' | 'UPLOADED';

export type ResumeCategory = 'BACKEND' | 'AI_ML' | 'FULL_STACK' | 'CUSTOM';

export interface SkillsJson {
  languages?: string[];
  frameworks?: string[];
  databases?: string[];
  tools?: string[];
  cloud?: string[];
  other?: string[];
}

export interface ExperienceJson {
  company: string;
  role?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
  description?: string;
  sourceBullets?: string[];
  highlights?: string[];
  whatWasBuilt?: string[];
  scaleAndOwnership?: string[];
  measurableImpact?: string[];
  technologies?: string[];
}

export interface EducationJson {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  field?: string;
  graduationYear?: number;
  startYear?: number;
  endYear?: number;
}

export interface ProjectJson {
  name: string;
  role?: string;
  technologies?: string[];
  techStack?: string[];
  description?: string;
  impact?: string;
  url?: string;
}

export interface CandidateProfileDto {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  summary: string | null;
  totalYearsExperience: number | null;
  skills: SkillsJson;
  experience: ExperienceJson[];
  education: EducationJson[];
  projects: ProjectJson[];
  certifications: string[];
  achievements: string[];
  links?: Record<string, string>;
  parsedAt: string;
}

export type ResumeProcessingStatus = 'READY' | 'PROCESSING' | 'FAILED';

export interface SlimCandidateProfileDto {
  id: string;
  name: string | null;
  title: string | null;
  topSkills: string[];
}

export interface ResumeListResponseDto {
  id: string;
  resumeFileId: string;
  candidateProfileId: string | null;
  originalFileName: string;
  label: string | null;
  category?: ResumeCategory;
  status: ResumeFileStatus;
  processingStatus: ResumeProcessingStatus;
  profile: SlimCandidateProfileDto | null;
  uploadedAt: string;
  skillsCount?: number;
  projectsCount?: number;
}

export interface ResumeResponseDto {
  id: string;
  originalFileName: string;
  fileName: string;
  label: string | null;
  category?: ResumeCategory;
  status: ResumeFileStatus;
  rawText: string | null;
  parseError: string | null;
  profile: CandidateProfileDto | null;
  uploadedAt: string;
  updatedAt: string;
}
