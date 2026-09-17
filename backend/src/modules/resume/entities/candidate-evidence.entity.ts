import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';
import { ResumeFile } from './resume-file.entity';
import { CandidateExperienceEntity } from './candidate-experience.entity';

export type CandidateSourceType = 'RESUME_BULLET' | 'SKILLS_SECTION' | 'PROJECT_ENTRY' | 'ACHIEVEMENT_ENTRY';
export type CandidateEvidenceCategory = 'DELIVERABLE' | 'ARCHITECTURE' | 'OPTIMIZATION' | 'SECURITY' | 'SKILL_KEYWORD' | 'ACHIEVEMENT';

@Entity('candidate_evidence')
export class CandidateEvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resume_id', type: 'uuid' })
  @Index('IDX_candidate_evidence_resume_id')
  resumeId: string;

  @ManyToOne(() => ResumeFile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resume_id' })
  resumeFile: ResumeFile;

  @Column({ name: 'candidate_profile_id', type: 'uuid' })
  @Index('IDX_candidate_evidence_profile_id')
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (profile) => profile.evidenceClaims, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ name: 'experience_id', type: 'uuid', nullable: true })
  @Index('IDX_candidate_evidence_experience_id')
  experienceId: string | null;

  @ManyToOne(() => CandidateExperienceEntity, (exp) => exp.evidenceClaims, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'experience_id' })
  experience: CandidateExperienceEntity | null;

  @Column({
    name: 'source_type',
    length: 50,
    default: 'RESUME_BULLET',
  })
  sourceType: CandidateSourceType;

  @Column({
    length: 50,
    default: 'DELIVERABLE',
  })
  category: CandidateEvidenceCategory;

  @Column({ name: 'bullet_index', type: 'int', nullable: true })
  bulletIndex: number | null;

  // SOURCE FACT: Verbatim literal string from resume
  @Column({ name: 'raw_bullet_text', type: 'text', nullable: true })
  rawBulletText: string | null;

  @Column({ name: 'deliverable_name', length: 255 })
  deliverableName: string;

  // NORMALIZED PARAPHRASE: Relay's extracted claim (NOT raw source text)
  @Column({ name: 'atomic_claim', type: 'text' })
  atomicClaim: string;

  @Column({ type: 'text', nullable: true })
  technologies: string | null;

  @Column({ name: 'is_source_fact', type: 'boolean', default: true })
  isSourceFact: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
