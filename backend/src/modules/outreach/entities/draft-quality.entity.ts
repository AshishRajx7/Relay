import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmailDraft } from './email-draft.entity';

@Entity('draft_quality')
export class DraftQuality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'email_draft_id', type: 'uuid' })
  @Index('IDX_draft_quality_email_draft_id', { unique: true })
  emailDraftId: string;

  @OneToOne(() => EmailDraft, (draft) => draft.quality, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'email_draft_id' })
  emailDraft: EmailDraft;

  @Column({ name: 'personalization_score', type: 'smallint', default: 0 })
  personalizationScore: number;

  @Column({ name: 'relevance_score', type: 'smallint', default: 0 })
  relevanceScore: number;

  @Column({ name: 'spam_risk_score', type: 'smallint', default: 0 })
  spamRiskScore: number;

  @Column({ name: 'technical_alignment_score', type: 'smallint', default: 0 })
  technicalAlignmentScore: number;

  @Column({ name: 'confidence_score', type: 'smallint', default: 0 })
  confidenceScore: number;

  @Column({ name: 'requires_manual_review', type: 'boolean', default: false })
  requiresManualReview: boolean;

  @Column({ type: 'jsonb', default: [] })
  flags: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
