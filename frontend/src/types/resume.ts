export type ResumeFileStatus = 'PENDING' | 'PARSED' | 'FAILED';

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
  role: string;
  duration?: string;
  description?: string;
  technologies?: string[];
}

export interface EducationJson {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  graduationYear?: number;
}

export interface ProjectJson {
  name: string;
  role?: string;
  technologies?: string[];
  description?: string;
  impact?: string;
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

export interface ResumeListResponseDto {
  id: string;
  originalFileName: string;
  label: string | null;
  status: ResumeFileStatus;
  uploadedAt: string;
  skillsCount?: number;
  projectsCount?: number;
}

export interface ResumeResponseDto {
  id: string;
  originalFileName: string;
  fileName: string;
  label: string | null;
  status: ResumeFileStatus;
  rawText: string | null;
  parseError: string | null;
  profile: CandidateProfileDto | null;
  uploadedAt: string;
  updatedAt: string;
}
