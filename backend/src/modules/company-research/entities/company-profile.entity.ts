import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Prospect } from '../../prospects/entities/prospect.entity';
import { CompanySource } from './company-source.entity';
import { CompanyEvidenceEntity } from './company-evidence.entity';

export interface CompanyEvidence {
  source: string;
  quote: string;
}

export interface DeterministicCoverageMetrics {
  pagesAttemptedCount: number;
  pagesSucceededCount: number;
  pagesFailedCount: number;
  totalWordCount: number;
  sectionsAcquired: Array<'HOMEPAGE' | 'ABOUT' | 'SERVICES' | 'CAREERS' | 'BLOG'>;
  hasCoreSummary: boolean;
  hasVerifiedProducts: boolean;
  hasTechnicalSignals: boolean;
  hasHiringSignals: boolean;
  coverageGaps: string[];
  coverageStatus: 'COMPLETE' | 'PARTIAL' | 'MINIMAL' | 'INSUFFICIENT';
}

@Entity('company_profiles')
export class CompanyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  @Index('IDX_company_profiles_domain')
  domain: string;

  @Column({ name: 'company_name', length: 255 })
  companyName: string;

  @Column({ length: 512, nullable: true })
  website: string | null;

  @Column({ length: 100, nullable: true })
  industry: string | null;

  @Column({ name: 'company_stage', length: 100, nullable: true })
  companyStage: string | null;

  @Column({ name: 'business_model', length: 100, nullable: true })
  businessModel: string | null;

  @Column({ name: 'employee_range', length: 100, nullable: true })
  employeeRange: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', default: [] })
  products: string[];

  @Column({ name: 'tech_signals', type: 'jsonb', default: [] })
  techSignals: string[];

  @Column({ name: 'hiring_signals', type: 'jsonb', default: [] })
  hiringSignals: string[];

  @Column({ name: 'recent_initiatives', type: 'jsonb', default: [] })
  recentInitiatives: string[];

  @Column({ type: 'jsonb', default: [] })
  evidence: CompanyEvidence[];

  @Column({ name: 'research_score', type: 'smallint', default: 0 })
  researchScore: number;

  @Column({ name: 'last_researched_at', type: 'timestamptz', nullable: true })
  lastResearchedAt: Date | null;

  @Column({ name: 'coverage_metadata', type: 'jsonb', default: {} })
  coverageMetadata: Partial<DeterministicCoverageMetrics>;

  @OneToMany(() => CompanySource, (source) => source.companyProfile)
  sources: CompanySource[];

  @OneToMany(() => CompanyEvidenceEntity, (evidence) => evidence.companyProfile)
  evidenceClaims: CompanyEvidenceEntity[];

  @OneToMany(() => Prospect, (prospect) => prospect.companyProfile)
  prospects: Prospect[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
