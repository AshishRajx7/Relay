import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CompanyEvidenceEntity } from '../../company-research/entities/company-evidence.entity';
import { CandidateEvidenceEntity } from '../../resume/entities/candidate-evidence.entity';

export type RelationshipType = 'DIRECT_TECHNICAL' | 'DOMAIN_ALIGNMENT' | 'PROBLEM_SPACE' | 'ENGINEERING_PRACTICE';
export type RelationshipQuality = 'HIGH' | 'MODERATE' | 'WEAK' | 'DISQUALIFIED_GENERIC_OVERLAP';

@Entity('relationship_match')
export class RelationshipMatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_evidence_id', type: 'uuid' })
  @Index('IDX_relationship_match_comp_ev')
  companyEvidenceId: string;

  @ManyToOne(() => CompanyEvidenceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_evidence_id' })
  companyEvidence: CompanyEvidenceEntity;

  @Column({ name: 'candidate_evidence_id', type: 'uuid' })
  @Index('IDX_relationship_match_cand_ev')
  candidateEvidenceId: string;

  @ManyToOne(() => CandidateEvidenceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_evidence_id' })
  candidateEvidence: CandidateEvidenceEntity;

  @Column({
    name: 'relationship_type',
    length: 50,
  })
  relationshipType: RelationshipType;

  // INFERRED RELATIONSHIP: Relay's analytical deduction or hypothesis (NOT source text)
  @Column({ name: 'is_inferred_relationship', type: 'boolean', default: true })
  isInferredRelationship: boolean;

  @Column({ name: 'analytical_rationale', type: 'text' })
  analyticalRationale: string;

  @Column({
    name: 'relationship_quality',
    length: 50,
  })
  relationshipQuality: RelationshipQuality;

  @Column({ name: 'ranking_score', type: 'int', nullable: true })
  rankingScore: number | null;

  @Column({ length: 50, nullable: true })
  directness: 'DIRECT' | 'INDIRECT' | 'ANALOGOUS' | null;

  @Column({ name: 'evidence_specificity', length: 50, nullable: true })
  evidenceSpecificity: 'HIGH' | 'MEDIUM' | 'LOW' | null;

  @Column({ name: 'candidate_ownership', length: 50, nullable: true })
  candidateOwnership: 'PRIMARY' | 'CONTRIBUTOR' | 'SUPPORTING' | null;

  @Column({ name: 'generic_overlap_detected', type: 'boolean', default: false })
  genericOverlapDetected: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
