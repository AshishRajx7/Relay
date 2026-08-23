import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';

export enum ResumeFileStatus {
  UPLOADED = 'UPLOADED',
  PARSING = 'PARSING',
  PARSED = 'PARSED',
  FAILED = 'FAILED',
}

@Entity('resume_file')
export class ResumeFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'original_file_name', length: 255 })
  originalFileName: string;

  @Column({ name: 'storage_path', length: 512 })
  storagePath: string;

  @Column({ name: 'file_hash', length: 64 })
  @Index('IDX_resume_file_hash')
  fileHash: string;

  @Column({
    type: 'enum',
    enum: ResumeFileStatus,
    default: ResumeFileStatus.UPLOADED,
  })
  @Index('IDX_resume_file_status')
  status: ResumeFileStatus;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string | null;

  @Column({ length: 100, nullable: true })
  label: string | null;

  @Column({ name: 'parse_error', type: 'text', nullable: true })
  parseError: string | null;

  @OneToOne(() => CandidateProfile, (profile) => profile.resumeFile, {
    cascade: true,
    eager: true,
  })
  profile: CandidateProfile | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
