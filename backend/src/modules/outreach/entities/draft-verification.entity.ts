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

export type VerificationSeverity = 'PASS' | 'REVIEW' | 'REJECT' | 'TERMINATED_NO_ANGLE';

export interface UnsupportedClaimItem {
  sentence: string;
  reason: string;
}

@Entity('draft_verification')
export class DraftVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'email_draft_id', type: 'uuid' })
  @Index('IDX_draft_verification_draft_id', { unique: true })
  emailDraftId: string;

  @OneToOne(() => EmailDraft, (draft: EmailDraft) => draft.verification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'email_draft_id' })
  emailDraft: EmailDraft;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({
    length: 50,
    default: 'PASS',
  })
  severity: VerificationSeverity;

  @Column({ name: 'total_claims_count', type: 'int', default: 0 })
  totalClaimsCount: number;

  @Column({ name: 'verified_claims_count', type: 'int', default: 0 })
  verifiedClaimsCount: number;

  @Column({ name: 'unsupported_claims', type: 'jsonb', default: [] })
  unsupportedClaims: UnsupportedClaimItem[];

  @Column({ name: 'cross_role_bleed_detected', type: 'boolean', default: false })
  crossRoleBleedDetected: boolean;

  @Column({ name: 'verifier_notes', type: 'text', nullable: true })
  verifierNotes: string | null;

  @CreateDateColumn({ name: 'verified_at', type: 'timestamptz' })
  verifiedAt: Date;
}
