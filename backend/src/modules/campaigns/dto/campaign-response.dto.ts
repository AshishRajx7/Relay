import { ApiProperty } from '@nestjs/swagger';
import { CampaignStatus } from '../entities/campaign.entity';

export class CampaignResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({ example: 'Series A DevTools Outreach Q3' })
  name: string;

  @ApiProperty({ example: 'be4f2886-1411-4752-ad6b-c5dbd275dd68' })
  candidateProfileId: string;

  @ApiProperty({ enum: CampaignStatus, example: CampaignStatus.PROCESSING })
  status: CampaignStatus;

  @ApiProperty({ example: 45 })
  totalProspects: number;

  @ApiProperty({ example: 38 })
  completedProspects: number;

  @ApiProperty({ example: '2026-08-25T01:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-25T01:05:00.000Z' })
  updatedAt: Date;
}
