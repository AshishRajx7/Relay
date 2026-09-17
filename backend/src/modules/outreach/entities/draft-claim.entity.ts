import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmailDraft } from './email-draft.entity';
import { CandidateEvidenceEntity } from '../../resume/entities/candidate-evidence.entity';
import { CompanyEvidenceEntity } from '../../company-research/entities/company-evidence.entity';

@Entity('draft_claim')
export class DraftClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'email_draft_id', type: 'uuid' })
  @Index('IDX_draft_claim_draft_id')
  emailDraftId: string;

  @ManyToOne(() => EmailDraft, (draft: EmailDraft) => draft.claims, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'email_draft_id' })
  emailDraft: EmailDraft;

  @Column({ name: 'sentence_index', type: 'int' })
  sentenceIndex: number;

  // GENERATED OUTREACH CLAIM: The actual sentence produced in the draft
  @Column({ type: 'text' })
  sentence: string;

  @Column({
    name: 'claim_type',
    length: 50,
    default: 'GENERATED_OUTREACH_CLAIM',
  })
  claimType: string;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'verification_issue', type: 'text', nullable: true })
  verificationIssue: string | null;

  @Column({ name: 'grounded_candidate_evidence_id', type: 'uuid', nullable: true })
  groundedCandidateEvidenceId: string | null;

  @ManyToOne(() => CandidateEvidenceEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'grounded_candidate_evidence_id' })
  groundedCandidateEvidence: CandidateEvidenceEntity | null;

  @Column({ name: 'grounded_company_evidence_id', type: 'uuid', nullable: true })
  groundedCompanyEvidenceId: string | null;

  @ManyToOne(() => CompanyEvidenceEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'grounded_company_evidence_id' })
  groundedCompanyEvidence: CompanyEvidenceEntity | null;
}
