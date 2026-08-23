import { ApiProperty } from '@nestjs/swagger';
import { ResearchStatus } from '../enums/research-status.enum';

export class TriggerResearchResponseDto {
  @ApiProperty({ example: '7d4fa664-e9f5-4c1c-96ad-1b99fced1d72' })
  id: string;

  @ApiProperty({ example: 'cfc7ac16-f8fc-4b42-bab2-6f80ef9ed658' })
  companyId: string;

  @ApiProperty({ enum: ResearchStatus, example: 'PENDING' })
  status: ResearchStatus;

  @ApiProperty({ example: 'Company research requested successfully.' })
  message: string;
}
