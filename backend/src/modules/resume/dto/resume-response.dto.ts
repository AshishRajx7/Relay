import { ResumeFileStatus } from '../entities/resume-file.entity';
import { CandidateProfileDto } from './candidate-profile.dto';

export class ResumeResponseDto {
  id: string;
  originalFileName: string;
  fileName: string;
  label: string | null;
  category: string;
  status: ResumeFileStatus;
  rawText: string | null;
  parseError: string | null;
  profile: CandidateProfileDto | null;
  uploadedAt: Date;
  updatedAt: Date;
}
