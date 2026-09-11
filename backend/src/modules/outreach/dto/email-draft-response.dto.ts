import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DraftStatus } from '../enums/draft-status.enum';
import { DraftReasoningJson } from '../entities/email-draft.entity';

export class EmailDraftContactDto {
  @ApiProperty({ example: 'cfc7ac16-f8fc-4b42-bab2-6f80ef9ed658' })
  id: string;

  @ApiProperty({ example: 'Patrick Collison' })
  name: string;

  @ApiProperty({ example: 'patrick@stripe.com' })
  email: string;

  @ApiPropertyOptional({ example: 'CEO & Co-founder', nullable: true })
  title: string | null;
}

export class EmailDraftCompanyDto {
  @ApiProperty({ example: '7d4fa664-e9f5-4c1c-96ad-1b99fced1d72' })
  id: string;

  @ApiProperty({ example: 'Stripe' })
  name: string;

  @ApiProperty({ example: 'stripe.com' })
  normalizedDomain: string;

  @ApiPropertyOptional({ example: 'FINTECH', nullable: true })
  persona: string | null;
}

export class EmailDraftResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ enum: DraftStatus, example: 'GENERATED' })
  status: DraftStatus;

  @ApiProperty({ example: 'Scaling Stripe backend with event-driven NestJS microservices' })
  subject: string | null;

  @ApiProperty({ example: ['Scaling Stripe backend with event-driven NestJS microservices', 'Ashish <> Stripe backend engineering'] })
  subjectVariations: string[];

  @ApiProperty({ example: 'Hi Patrick,\n\nNoticed Stripe is expanding its core infrastructure following the v2 Core API launch...' })
  bodyText: string | null;

  @ApiProperty({ example: 92 })
  personalizationScore: number | null;

  @ApiProperty({ example: 98 })
  wordCount: number;

  @ApiPropertyOptional({
    example: {
      whyCompany: 'Direct reference to Stripe v2 Core API expansion',
      whyNow: 'Actively scaling backend infrastructure to 50M+ daily requests',
      whyMe: 'Hands-on experience architecting 10M+ daily request microservices',
      matchingProjects: [{ projectName: 'Relay Engine', relevantTech: ['NestJS', 'BullMQ'], pitchRelevance: 'Matches architecture' }],
    },
  })
  reasoning: DraftReasoningJson;

  @ApiProperty({ type: EmailDraftContactDto })
  contact: EmailDraftContactDto;

  @ApiProperty({ type: EmailDraftCompanyDto })
  company: EmailDraftCompanyDto;

  @ApiPropertyOptional({ example: null, nullable: true })
  errorMessage: string | null;

  @ApiPropertyOptional({ example: '2026-08-23T10:00:00.000Z', nullable: true })
  generatedAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  approvedAt: Date | null;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  updatedAt: Date;
}
