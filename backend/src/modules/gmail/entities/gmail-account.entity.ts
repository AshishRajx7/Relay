import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('gmail_accounts')
export class GmailAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id', type: 'uuid', nullable: true })
  candidateProfileId: string | null;

  @Column({ length: 255, unique: true })
  @Index('IDX_gmail_accounts_email')
  email: string;

  @Column({ name: 'google_user_id', length: 255, nullable: true })
  googleUserId: string | null;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'connected_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  connectedAt: Date;

  @Column({ name: 'last_sync_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastSyncAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
