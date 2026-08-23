import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResearchStatus } from '../enums/research-status.enum';
import { CompanyPersona } from '../enums/company-persona.enum';

export class CompanyResearchResponseDto {
  @ApiProperty({ example: '7d4fa664-e9f5-4c1c-96ad-1b99fced1d72' })
  id: string;

  @ApiProperty({ example: 'cfc7ac16-f8fc-4b42-bab2-6f80ef9ed658' })
  companyId: string;

  @ApiProperty({ enum: ResearchStatus, example: 'COMPLETED' })
  status: ResearchStatus;

  @ApiPropertyOptional({ enum: CompanyPersona, example: 'SAAS', nullable: true })
  persona: CompanyPersona | null;

  @ApiPropertyOptional({ example: 'Developer Tools', nullable: true })
  industry: string | null;

  @ApiPropertyOptional({ example: '51-200', nullable: true })
  companySize: string | null;

  @ApiPropertyOptional({
    example: 'TechFlow Systems provides scalable cloud backend services for modern startups.',
    nullable: true,
  })
  summary: string | null;

  @ApiProperty({ example: ['Cloud', 'Backend', 'Kubernetes', 'NestJS'] })
  keywords: string[];

  @ApiProperty({ example: ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis'] })
  techStack: string[];

  @ApiProperty({ example: ['TechFlow Cloud API', 'TechFlow CLI'] })
  products: string[];

  @ApiPropertyOptional({ example: '# TechFlow Systems\n\nAbout us...', nullable: true })
  rawMarkdown: string | null;

  @ApiPropertyOptional({ example: 85, nullable: true })
  researchQualityScore: number | null;

  @ApiPropertyOptional({
    example: 'Page coverage: 25/25 | Content: 20/25 | AI: 20/25 | Keywords: 20/25',
    nullable: true,
  })
  qualityReason: string | null;

  @ApiPropertyOptional({
    example: { pagesCrawled: 4, totalWordCount: 2300 },
    nullable: true,
  })
  crawlMetadata: Record<string, any> | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  lastError: string | null;

  @ApiPropertyOptional({ example: '2026-08-23T10:00:00.000Z', nullable: true })
  researchedAt: Date | null;

  @ApiPropertyOptional({ example: '2026-09-22T10:00:00.000Z', nullable: true })
  expiresAt: Date | null;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  updatedAt: Date;
}
