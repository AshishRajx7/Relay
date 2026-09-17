import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CompanyProfile } from './company-profile.entity';
import { CompanySource } from './company-source.entity';

export type CompanyEvidenceCategory = 'PRODUCT' | 'ARCHITECTURE' | 'TECH_STACK' | 'CUSTOMER_PROBLEM' | 'BUSINESS_MODEL' | 'INITIATIVE';

@Entity('company_evidence')
export class CompanyEvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_profile_id', type: 'uuid' })
  @Index('IDX_company_evidence_profile_id')
  companyProfileId: string;

  @ManyToOne(() => CompanyProfile, (profile: CompanyProfile) => profile.evidenceClaims, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_profile_id' })
  companyProfile: CompanyProfile;

  @Column({ name: 'source_id', type: 'uuid' })
  @Index('IDX_company_evidence_source_id')
  sourceId: string;

  @ManyToOne(() => CompanySource, (source: CompanySource) => source.evidenceClaims, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: CompanySource;

  @Column({ name: 'source_url', length: 500 })
  sourceUrl: string;

  // SOURCE FACT: Exact contiguous substring from source.rawMarkdown
  @Column({ name: 'verbatim_quote', type: 'text' })
  verbatimQuote: string;

  // NORMALIZED PARAPHRASE: Relay's extracted claim (NOT raw source text)
  @Column({ name: 'atomic_claim', type: 'text' })
  atomicClaim: string;

  @Column({
    length: 50,
    default: 'PRODUCT',
  })
  category: CompanyEvidenceCategory;

  @Column({ type: 'real', default: 1.0 })
  confidence: number;

  @Column({ name: 'is_source_fact', type: 'boolean', default: true })
  isSourceFact: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
