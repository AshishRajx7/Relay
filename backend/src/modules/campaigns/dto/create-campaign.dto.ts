import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Name of the outreach campaign',
    example: 'Series A DevTools Outreach Q3',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Candidate Profile ID to attach to this campaign',
    example: 'be4f2886-1411-4752-ad6b-c5dbd275dd68',
  })
  @IsUUID()
  @IsNotEmpty()
  candidateProfileId: string;
}
