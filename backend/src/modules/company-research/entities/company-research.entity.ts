import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { ResearchStatus } from '../enums/research-status.enum';
import { CompanyPersona } from '../enums/company-persona.enum';

export interface OutreachHooksJson {
  whyThisCompany?: string;
  whyNow?: string;
  keyProblemsSolving?: string[];
  engineeringCultureSignals?: string[];
  recentMilestones?: string[];
}

@Entity('company_research')
export class CompanyResearch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  @Index('IDX_company_research_company_id')
  companyId: string;

  @ManyToOne(() => Company, (company) => company.researches, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({
    type: 'enum',
    enum: ResearchStatus,
    default: ResearchStatus.PENDING,
  })
  @Index('IDX_company_research_status')
  status: ResearchStatus;

  @Column({
    type: 'enum',
    enum: CompanyPersona,
    nullable: true,
  })
  persona: CompanyPersona | null;

  @Column({ length: 255, nullable: true })
  industry: string | null;

  @Column({ name: 'company_size', length: 100, nullable: true })
  companySize: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', default: [] })
  keywords: string[];

  @Column({ name: 'tech_stack', type: 'jsonb', default: [] })
  techStack: string[];

  @Column({ type: 'jsonb', default: [] })
  products: string[];

  @Column({ name: 'raw_markdown', type: 'text', nullable: true, select: false })
  rawMarkdown: string | null;

  @Column({ name: 'careers_page_url', length: 512, nullable: true })
  careersPageUrl: string | null;

  @Column({ name: 'ats_provider', length: 50, nullable: true })
  @Index('IDX_company_research_ats_provider')
  atsProvider: string | null;

  @Column({ name: 'is_hiring', type: 'boolean', default: false })
  @Index('IDX_company_research_is_hiring')
  isHiring: boolean;

  @Column({ name: 'hiring_signals', type: 'jsonb', default: [] })
  hiringSignals: string[];

  @Column({ name: 'generic_contact_emails', type: 'jsonb', default: [] })
  genericContactEmails: string[];

  @Column({ name: 'target_departments', type: 'jsonb', default: [] })
  targetDepartments: string[];

  @Column({ type: 'jsonb', default: [] })
  locations: string[];

  @Column({ name: 'outreach_hooks', type: 'jsonb', default: {} })
  outreachHooks: OutreachHooksJson;

  @Column({ name: 'research_quality_score', type: 'smallint', nullable: true })
  researchQualityScore: number | null;

  @Column({ name: 'quality_reason', type: 'text', nullable: true })
  qualityReason: string | null;

  @Column({ name: 'crawl_metadata', type: 'jsonb', nullable: true })
  crawlMetadata: Record<string, any> | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'researched_at', type: 'timestamptz', nullable: true })
  researchedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  @Index('IDX_company_research_expires_at')
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
