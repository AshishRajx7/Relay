import { ResumeFileStatus } from '../entities/resume-file.entity';

export type ResumeProcessingStatus = 'READY' | 'PROCESSING' | 'FAILED';

export interface SlimCandidateProfileDto {
  id: string;
  name: string | null;
  title: string | null;
  topSkills: string[];
}

export class ResumeListResponseDto {
  id: string;
  resumeFileId: string;
  candidateProfileId: string | null;
  originalFileName: string;
  label: string | null;
  category: string;
  status: ResumeFileStatus;
  processingStatus: ResumeProcessingStatus;
  profile: SlimCandidateProfileDto | null;
  uploadedAt: Date;
}
