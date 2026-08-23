import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyPersona } from '../enums/company-persona.enum';
import { ResearchStatus } from '../../company-research/enums/research-status.enum';

export class CompanyResearchSummaryDto {
  @ApiProperty({ enum: ResearchStatus, example: 'COMPLETED' })
  status: ResearchStatus;

  @ApiPropertyOptional({ example: 85, nullable: true })
  researchQualityScore: number | null;

  @ApiPropertyOptional({ enum: CompanyPersona, example: 'SAAS', nullable: true })
  persona: CompanyPersona | null;

  @ApiPropertyOptional({ example: 'Developer Tools', nullable: true })
  industry: string | null;

  @ApiPropertyOptional({ example: '51-200', nullable: true })
  companySize: string | null;

  @ApiPropertyOptional({
    example: 'Relay builds AI-driven cold outreach infrastructure for fast-growing startups.',
    nullable: true,
  })
  summary: string | null;

  @ApiPropertyOptional({ example: '2026-08-23T10:00:00.000Z', nullable: true })
  researchedAt: Date | null;

  @ApiPropertyOptional({ example: '2026-09-22T10:00:00.000Z', nullable: true })
  expiresAt: Date | null;
}

export class CompanyResponseDto {
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  id: string;

  @ApiProperty({ example: 'Acme Corp' })
  name: string;

  @ApiProperty({ example: 'https://acme.com' })
  website: string;

  @ApiProperty({ example: 'acme.com' })
  normalizedDomain: string;

  @ApiProperty({ example: 3 })
  contactCount: number;

  @ApiPropertyOptional({ type: () => CompanyResearchSummaryDto, nullable: true })
  research: CompanyResearchSummaryDto | null;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  updatedAt: Date;
}
