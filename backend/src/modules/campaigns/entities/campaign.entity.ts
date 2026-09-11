import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CandidateProfile } from '../../resume/entities/candidate-profile.entity';
import { Prospect } from '../../prospects/entities/prospect.entity';

export enum CampaignStatus {
  CREATED = 'CREATED',
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  PAUSED = 'PAUSED',
  FAILED = 'FAILED',
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'candidate_profile_id', type: 'uuid' })
  @Index('IDX_campaigns_candidate_profile_id')
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({
    type: 'varchar',
    length: 50,
    default: CampaignStatus.CREATED,
  })
  status: CampaignStatus;

  @Column({ name: 'total_prospects', type: 'integer', default: 0 })
  totalProspects: number;

  @Column({ name: 'completed_prospects', type: 'integer', default: 0 })
  completedProspects: number;

  @Column({ name: 'manual_review_count', type: 'integer', default: 0 })
  manualReviewCount: number;

  @Column({ name: 'gmail_draft_count', type: 'integer', default: 0 })
  gmailDraftCount: number;

  @Column({ name: 'crawl_count', type: 'integer', default: 0 })
  crawlCount: number;

  @Column({ name: 'llm_calls', type: 'integer', default: 0 })
  llmCalls: number;

  @Column({ name: 'estimated_cost_usd', type: 'numeric', precision: 10, scale: 4, default: 0 })
  estimatedCostUsd: number;

  @OneToMany(() => Prospect, (prospect) => prospect.campaign)
  prospects: Prospect[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
