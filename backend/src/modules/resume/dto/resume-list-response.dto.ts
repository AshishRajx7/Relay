import { ResumeFileStatus } from '../entities/resume-file.entity';

export interface SlimCandidateProfileDto {
  name: string | null;
  title: string | null;
  topSkills: string[];
}

export class ResumeListResponseDto {
  id: string;
  originalFileName: string;
  label: string | null;
  status: ResumeFileStatus;
  profile: SlimCandidateProfileDto | null;
  uploadedAt: Date;
}
