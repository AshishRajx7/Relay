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

  @Column({ name: 'selected_resume_id', type: 'uuid', nullable: true })
  selectedResumeId: string | null;

  @Column({ name: 'selected_resume_name', length: 255, nullable: true })
  selectedResumeName: string | null;

  @Column({ name: 'selected_resume_category', length: 50, nullable: true })
  selectedResumeCategory: string | null;

  @Column({ name: 'selection_reason', type: 'text', nullable: true })
  selectionReason: string | null;

  @Column({ name: 'evidence_used', type: 'jsonb', default: [] })
  evidenceUsed: string[];

  @Column({ name: 'projects_referenced', type: 'jsonb', default: [] })
  projectsReferenced: string[];

  @Column({ name: 'key_matches', type: 'jsonb', default: [] })
  keyMatches: string[];

  @Column({ name: 'reason_contact_chosen', type: 'text', nullable: true })
  reasonContactChosen: string | null;

  @Column({ name: 'why_me_points', type: 'jsonb', default: [] })
  whyMePoints: string[];

  @Column({ name: 'missing_skills', type: 'jsonb', default: [] })
  missingSkills: string[];

  @Column({ name: 'all_resume_scores', type: 'jsonb', default: [] })
  allResumeScores: Array<{ resumeId: string; resumeName: string; category: string; score: number; reason: string; isSelected: boolean }>;

  @Column({ name: 'recommended_talking_points', type: 'jsonb', default: [] })
  recommendedTalkingPoints: string[];

  @Column({ name: 'no_angle_reason', length: 50, nullable: true })
  noAngleReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
