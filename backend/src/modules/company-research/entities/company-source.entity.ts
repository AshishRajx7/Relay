import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CompanyProfile } from './company-profile.entity';
import { CompanyEvidenceEntity } from './company-evidence.entity';

export type CompanySourceSection = 'HOMEPAGE' | 'ABOUT' | 'SERVICES' | 'CAREERS' | 'BLOG' | 'OTHER';

@Entity('company_source')
export class CompanySource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_profile_id', type: 'uuid' })
  @Index('IDX_company_source_profile_id')
  companyProfileId: string;

  @ManyToOne(() => CompanyProfile, (profile: CompanyProfile) => profile.sources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_profile_id' })
  companyProfile: CompanyProfile;

  @Column({ length: 500 })
  url: string;

  @Column({ length: 255, nullable: true })
  title: string | null;

  @Column({
    length: 50,
    default: 'HOMEPAGE',
  })
  section: CompanySourceSection;

  @Column({ name: 'http_status', type: 'int', default: 200 })
  httpStatus: number;

  // SOURCE FACT: Verbatim scraped markdown content from the webpage
  @Column({ name: 'raw_markdown', type: 'text' })
  rawMarkdown: string;

  @Column({ name: 'content_hash', length: 64 })
  contentHash: string;

  @Column({ name: 'word_count', type: 'int', default: 0 })
  wordCount: number;

  @OneToMany(() => CompanyEvidenceEntity, (evidence: CompanyEvidenceEntity) => evidence.source)
  evidenceClaims: CompanyEvidenceEntity[];

  @CreateDateColumn({ name: 'retrieved_at', type: 'timestamptz' })
  retrievedAt: Date;
}
