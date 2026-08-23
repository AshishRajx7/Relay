import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ResumeFile } from './resume-file.entity';

export interface SkillsJson {
  languages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  other: string[];
}

export interface ExperienceJson {
  company: string;
  title: string;
  location?: string | null;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface EducationJson {
  institution: string;
  degree: string;
  field: string;
  graduationDate?: string | null;
  gpa?: string | null;
}

export interface ProjectJson {
  name: string;
  description: string;
  techStack: string[];
  url?: string | null;
}

export interface LinksJson {
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
}

@Entity('candidate_profile')
export class CandidateProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resume_file_id', type: 'uuid' })
  @Index('UQ_candidate_profile_resume_file_id', { unique: true })
  resumeFileId: string;

  @OneToOne(() => ResumeFile, (resumeFile) => resumeFile.profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resume_file_id' })
  resumeFile: ResumeFile;

  @Column({ length: 255, nullable: true })
  name: string | null;

  @Column({ length: 255, nullable: true })
  email: string | null;

  @Column({ length: 50, nullable: true })
  phone: string | null;

  @Column({ length: 255, nullable: true })
  location: string | null;

  @Column({ length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'total_years_experience', type: 'real', nullable: true })
  totalYearsExperience: number | null;

  @Column({
    type: 'jsonb',
    default: { languages: [], frameworks: [], databases: [], tools: [], other: [] },
  })
  skills: SkillsJson;

  @Column({ type: 'jsonb', default: [] })
  experience: ExperienceJson[];

  @Column({ type: 'jsonb', default: [] })
  education: EducationJson[];

  @Column({ type: 'jsonb', default: [] })
  projects: ProjectJson[];

  @Column({ type: 'jsonb', default: [] })
  certifications: string[];

  @Column({ type: 'jsonb', default: { linkedin: null, github: null, portfolio: null } })
  links: LinksJson;

  @CreateDateColumn({ name: 'parsed_at', type: 'timestamptz' })
  parsedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
