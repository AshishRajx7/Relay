import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Prospect } from '../../prospects/entities/prospect.entity';
import { DraftReasoning } from './draft-reasoning.entity';
import { DraftQuality } from './draft-quality.entity';
import { EmailDraftVariant } from './email-draft-variant.entity';
import { OutreachStrategyEntity } from './outreach-strategy.entity';
import { DraftClaimEntity } from './draft-claim.entity';
import { DraftVerificationEntity } from './draft-verification.entity';

export interface DraftReasoningJson {
  whyCompany?: string;
  whyNow?: string;
  whyMe?: string;
  whyRelevant?: string;
  matchedTechnologies?: string[];
  chosenProject?: string;
  matchingProjects?: Array<{ projectName: string; relevantTech: string[]; pitchRelevance: string }>;
}

export enum OutreachDraftStatus {
  GENERATED = 'GENERATED',
  EDITED = 'EDITED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  READY_FOR_APPROVAL = 'READY_FOR_APPROVAL',
  APPROVED = 'APPROVED',
  GMAIL_DRAFT_CREATED = 'GMAIL_DRAFT_CREATED',
  NO_SUFFICIENT_OUTREACH_ANGLE = 'NO_SUFFICIENT_OUTREACH_ANGLE',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  REJECTED = 'REJECTED',
}

@Entity('email_drafts')
export class EmailDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'prospect_id', type: 'uuid' })
  @Index('IDX_email_drafts_prospect_id', { unique: true })
  prospectId: string;

  @OneToOne(() => Prospect, (prospect) => prospect.emailDraft, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prospect_id' })
  prospect: Prospect;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: OutreachDraftStatus.GENERATED,
  })
  @Index('IDX_email_drafts_status')
  status: OutreachDraftStatus;

  @Column({ name: 'gmail_draft_id', length: 255, nullable: true })
  gmailDraftId: string | null;

  @Column({ name: 'gmail_thread_id', length: 255, nullable: true })
  gmailThreadId: string | null;

  @OneToOne(() => DraftReasoning, (reasoning) => reasoning.emailDraft, { cascade: true })
  reasoning: DraftReasoning;

  @OneToOne(() => DraftQuality, (quality) => quality.emailDraft, { cascade: true })
  quality: DraftQuality;

  @OneToMany(() => EmailDraftVariant, (variant) => variant.emailDraft, { cascade: true })
  variants: EmailDraftVariant[];

  @OneToOne(() => OutreachStrategyEntity, (strategy) => strategy.emailDraft, { cascade: true })
  strategy: OutreachStrategyEntity;

  @OneToMany(() => DraftClaimEntity, (claim) => claim.emailDraft, { cascade: true })
  claims: DraftClaimEntity[];

  @OneToOne(() => DraftVerificationEntity, (verification) => verification.emailDraft, { cascade: true })
  verification: DraftVerificationEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
