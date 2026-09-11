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
  APPROVED = 'APPROVED',
  GMAIL_DRAFT_CREATED = 'GMAIL_DRAFT_CREATED',
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
