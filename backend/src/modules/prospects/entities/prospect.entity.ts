import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';
import { EmailDraft } from '../../outreach/entities/email-draft.entity';

export enum ProspectSourceType {
  CSV = 'CSV',
  PDF = 'PDF',
  MANUAL = 'MANUAL',
}

export enum ContactType {
  HR = 'HR',
  RECRUITER = 'RECRUITER',
  FOUNDER = 'FOUNDER',
  ENGINEERING = 'ENGINEERING',
  PRODUCT = 'PRODUCT',
  GENERAL = 'GENERAL',
  UNSUPPORTED_CONTACT = 'UNSUPPORTED_CONTACT',
}

export enum ProspectResearchStatus {
  PENDING = 'PENDING',
  RESEARCHING = 'RESEARCHING',
  RESEARCHED = 'RESEARCHED',
  RESEARCH_RETRY_REQUIRED = 'RESEARCH_RETRY_REQUIRED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  UNSUPPORTED_CONTACT = 'UNSUPPORTED_CONTACT',
  FAILED = 'FAILED',
}

export enum ProspectDraftStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  GENERATED = 'GENERATED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  READY_FOR_APPROVAL = 'READY_FOR_APPROVAL',
  APPROVED = 'APPROVED',
  GMAIL_DRAFT_CREATED = 'GMAIL_DRAFT_CREATED',
  NO_SUFFICIENT_OUTREACH_ANGLE = 'NO_SUFFICIENT_OUTREACH_ANGLE',
  FAILED = 'FAILED',
}

export enum NoOutreachAngleReason {
  NO_TECHNICAL_SIGNAL = 'NO_TECHNICAL_SIGNAL',
  NO_DOMAIN_ALIGNMENT = 'NO_DOMAIN_ALIGNMENT',
  GENERIC_TECH_OVERLAP_ONLY = 'GENERIC_TECH_OVERLAP_ONLY',
  INSUFFICIENT_COMPANY_RESEARCH = 'INSUFFICIENT_COMPANY_RESEARCH',
  INSUFFICIENT_CANDIDATE_EVIDENCE = 'INSUFFICIENT_CANDIDATE_EVIDENCE',
  LOW_RELATIONSHIP_STRENGTH = 'LOW_RELATIONSHIP_STRENGTH',
  NO_CREDIBLE_PERSONALIZATION = 'NO_CREDIBLE_PERSONALIZATION',
  DRAFT_VALIDATION_FAILED = 'DRAFT_VALIDATION_FAILED',
  DRAFT_VERIFICATION_FAILED = 'DRAFT_VERIFICATION_FAILED',
}

export enum PersonalizationLevel {
  PERSONALIZED = 'PERSONALIZED',
  PARTIALLY_PERSONALIZED = 'PARTIALLY_PERSONALIZED',
  GENERAL_COLD_OUTREACH = 'GENERAL_COLD_OUTREACH',
}

export enum ProspectFailureType {
  RETRYABLE = 'RETRYABLE',
  PERMANENT = 'PERMANENT',
}

@Entity('prospects')
@Unique('UQ_prospects_campaign_email', ['campaignId', 'email'])
export class Prospect {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'personalization_level',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  personalizationLevel: PersonalizationLevel | null;

  @Column({ name: 'campaign_id', type: 'uuid' })
  @Index('IDX_prospects_campaign_id')
  campaignId: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.prospects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'company_profile_id', type: 'uuid', nullable: true })
  @Index('IDX_prospects_company_profile_id')
  companyProfileId: string | null;

  @ManyToOne(() => CompanyProfile, (companyProfile) => companyProfile.prospects, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'company_profile_id' })
  companyProfile: CompanyProfile | null;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 255 })
  @Index('IDX_prospects_domain')
  domain: string;

  @Column({ name: 'company_name', length: 255, nullable: true })
  companyName: string | null;

  @Column({
    name: 'source_type',
    type: 'varchar',
    length: 50,
    default: ProspectSourceType.CSV,
  })
  sourceType: ProspectSourceType;

  @Column({
    name: 'contact_type',
    type: 'varchar',
    length: 50,
    default: ContactType.GENERAL,
  })
  contactType: ContactType;

  @Column({
    name: 'research_status',
    type: 'varchar',
    length: 50,
    default: ProspectResearchStatus.PENDING,
  })
  @Index('IDX_prospects_research_status')
  researchStatus: ProspectResearchStatus;

  @Column({
    name: 'draft_status',
    type: 'varchar',
    length: 50,
    default: ProspectDraftStatus.PENDING,
  })
  draftStatus: ProspectDraftStatus;

  @Column({
    name: 'failure_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  failureType: ProspectFailureType | null;

  @Column({
    name: 'no_angle_reason',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  noAngleReason: NoOutreachAngleReason | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @OneToOne(() => EmailDraft, (draft) => draft.prospect)
  emailDraft: EmailDraft;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
