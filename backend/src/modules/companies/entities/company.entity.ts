import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';
import { CompanyResearch } from '../../company-research/entities/company-research.entity';

@Entity('company')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 512 })
  website: string;

  @Column({ name: 'normalized_domain', length: 255, unique: true })
  @Index('UQ_company_normalized_domain', { unique: true })
  normalizedDomain: string;

  @OneToMany(() => Contact, (contact) => contact.company)
  contacts: Contact[];

  @OneToMany(() => CompanyResearch, (research) => research.company)
  researches: CompanyResearch[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
