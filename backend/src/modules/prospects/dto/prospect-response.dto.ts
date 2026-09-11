import { ApiProperty } from '@nestjs/swagger';
import {
  ProspectSourceType,
  ProspectResearchStatus,
  ProspectDraftStatus,
} from '../entities/prospect.entity';
import { CompanyProfile } from '../../company-research/entities/company-profile.entity';

export class ProspectResponseDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  campaignId: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f', nullable: true })
  companyProfileId: string | null;

  @ApiProperty({ example: 'alex@stripe.com' })
  email: string;

  @ApiProperty({ example: 'stripe.com' })
  domain: string;

  @ApiProperty({ example: 'Stripe', nullable: true })
  companyName: string | null;

  @ApiProperty({ enum: ProspectSourceType, example: ProspectSourceType.CSV })
  sourceType: ProspectSourceType;

  @ApiProperty({ enum: ProspectResearchStatus, example: ProspectResearchStatus.RESEARCHED })
  researchStatus: ProspectResearchStatus;

  @ApiProperty({ enum: ProspectDraftStatus, example: ProspectDraftStatus.PENDING })
  draftStatus: ProspectDraftStatus;

  @ApiProperty({ example: null, nullable: true })
  error: string | null;

  @ApiProperty({ nullable: true })
  companyProfile?: CompanyProfile | null;

  @ApiProperty({ example: '2026-08-25T01:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-25T01:05:00.000Z' })
  updatedAt: Date;
}
