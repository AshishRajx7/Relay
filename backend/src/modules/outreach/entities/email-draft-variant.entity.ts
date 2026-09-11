import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmailDraft } from './email-draft.entity';

export enum EmailVariantType {
  TECHNICAL = 'TECHNICAL',
  STARTUP = 'STARTUP',
  DIRECT = 'DIRECT',
}

@Entity('email_draft_variants')
export class EmailDraftVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'email_draft_id', type: 'uuid' })
  @Index('IDX_email_draft_variants_email_draft_id')
  emailDraftId: string;

  @ManyToOne(() => EmailDraft, (draft) => draft.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'email_draft_id' })
  emailDraft: EmailDraft;

  @Column({
    name: 'variant_type',
    type: 'varchar',
    length: 50,
  })
  variantType: EmailVariantType;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'word_count', type: 'integer', default: 0 })
  wordCount: number;

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

  @Column({ name: 'is_selected', type: 'boolean', default: false })
  isSelected: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
