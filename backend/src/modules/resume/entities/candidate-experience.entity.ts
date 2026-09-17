import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';
import { ResumeFile } from './resume-file.entity';
import { CandidateEvidenceEntity } from './candidate-evidence.entity';

export type ExperienceTenureType = 'FULL_TIME' | 'INTERNSHIP' | 'FOUNDER' | 'CONTRACT' | 'PART_TIME';

@Entity('candidate_experience')
export class CandidateExperienceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resume_id', type: 'uuid' })
  @Index('IDX_candidate_experience_resume_id')
  resumeId: string;

  @ManyToOne(() => ResumeFile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resume_id' })
  resumeFile: ResumeFile;

  @Column({ name: 'candidate_profile_id', type: 'uuid' })
  @Index('IDX_candidate_experience_profile_id')
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (profile: CandidateProfile) => profile.experiences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ length: 255 })
  employer: string;

  @Column({ name: 'role_title', length: 255 })
  roleTitle: string;

  @Column({
    name: 'tenure_type',
    length: 50,
    default: 'FULL_TIME',
  })
  tenureType: ExperienceTenureType;

  @Column({ name: 'start_date', length: 50 })
  startDate: string;

  @Column({ name: 'end_date', length: 50 })
  endDate: string;

  @Column({ length: 255, nullable: true })
  location: string | null;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @OneToMany(() => CandidateEvidenceEntity, (evidence: CandidateEvidenceEntity) => evidence.experience)
  evidenceClaims: CandidateEvidenceEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
