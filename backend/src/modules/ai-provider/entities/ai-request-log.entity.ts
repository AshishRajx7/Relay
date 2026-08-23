import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AiRequestStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('ai_request_log')
export class AiRequestLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  @Index()
  provider: string;

  @Column({ length: 50 })
  model: string;

  @Column({ length: 50 })
  @Index()
  feature: string; // e.g. 'RESUME_PARSE', 'COMPANY_RESEARCH', 'MATCHING', 'DRAFT_GEN'

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens: number;

  @Column({ name: 'total_tokens', type: 'int', default: 0 })
  totalTokens: number;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs: number;

  @Column({
    type: 'enum',
    enum: AiRequestStatus,
    default: AiRequestStatus.SUCCESS,
  })
  status: AiRequestStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  @Index()
  createdAt: Date;
}
