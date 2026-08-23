import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResearchStatus } from '../../company-research/enums/research-status.enum';

export class CompanyListResearchSummaryDto {
  @ApiProperty({ enum: ResearchStatus, example: 'COMPLETED' })
  status: ResearchStatus;

  @ApiPropertyOptional({ example: 85, nullable: true })
  researchQualityScore: number | null;

  @ApiPropertyOptional({ example: '2026-08-23T10:00:00.000Z', nullable: true })
  researchedAt: Date | null;
}

export class CompanyListResponseDto {
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

  @ApiPropertyOptional({ type: () => CompanyListResearchSummaryDto, nullable: true })
  research: CompanyListResearchSummaryDto | null;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  createdAt: Date;
}
