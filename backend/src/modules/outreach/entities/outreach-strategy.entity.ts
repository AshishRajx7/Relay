import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmailDraft } from './email-draft.entity';
import { RelationshipMatchEntity } from './relationship-match.entity';

export type RecipientClassification = 'ENGINEERING_PEER' | 'ENGINEERING_MANAGER' | 'EXECUTIVE' | 'RECRUITER' | 'UNKNOWN';
export type OutreachObjective = 'START_CONVERSATION' | 'EXPRESS_INTEREST';
export type OutreachTone = 'PEER' | 'PROFESSIONAL' | 'CONCISE';

@Entity('outreach_strategy')
export class OutreachStrategyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'email_draft_id', type: 'uuid' })
  @Index('IDX_outreach_strategy_draft_id', { unique: true })
  emailDraftId: string;

  @OneToOne(() => EmailDraft, (draft: EmailDraft) => draft.strategy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'email_draft_id' })
  emailDraft: EmailDraft;

  @Column({
    name: 'recipient_classification',
    length: 50,
  })
  recipientClassification: RecipientClassification;

  @Column({ name: 'primary_match_id', type: 'uuid', nullable: true })
  primaryMatchId: string | null;

  @ManyToOne(() => RelationshipMatchEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'primary_match_id' })
  primaryMatch: RelationshipMatchEntity | null;

  @Column({
    length: 50,
    default: 'START_CONVERSATION',
  })
  objective: OutreachObjective;

  @Column({
    length: 50,
    default: 'PEER',
  })
  tone: OutreachTone;

  @Column({ name: 'avoid_topics', type: 'text', nullable: true })
  avoidTopics: string | null;

  @Column({ name: 'closing_strategy', type: 'text', nullable: true })
  closingStrategy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
