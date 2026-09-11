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

export interface RankedMatch {
  rank: number;
  project: string;
  score: number;
}

@Entity('draft_reasoning')
export class DraftReasoning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'email_draft_id', type: 'uuid' })
  @Index('IDX_draft_reasoning_email_draft_id', { unique: true })
  emailDraftId: string;

  @OneToOne(() => EmailDraft, (draft) => draft.reasoning, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'email_draft_id' })
  emailDraft: EmailDraft;

  @Column({ name: 'chosen_project', length: 255 })
  chosenProject: string;

  @Column({ name: 'match_score', type: 'smallint', default: 0 })
  matchScore: number;

  @Column({ name: 'why_company', type: 'text' })
  whyCompany: string;

  @Column({ name: 'why_me', type: 'text' })
  whyMe: string;

  @Column({ name: 'why_now', type: 'text', nullable: true })
  whyNow: string | null;

  @Column({ name: 'why_relevant', type: 'text' })
  whyRelevant: string;

  @Column({ name: 'matched_technologies', type: 'jsonb', default: [] })
  matchedTechnologies: string[];

  @Column({ name: 'ranked_matches', type: 'jsonb', default: [] })
  rankedMatches: RankedMatch[];

  @Column({ name: 'confidence_level', length: 50, default: 'HIGH' })
  confidenceLevel: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
