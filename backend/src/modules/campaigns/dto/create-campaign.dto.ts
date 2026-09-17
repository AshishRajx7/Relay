import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Name of the outreach campaign',
    example: 'Series A DevTools Outreach Q3',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Optional Candidate Profile ID to attach to this campaign (defaults to active profile)',
    example: 'be4f2886-1411-4752-ad6b-c5dbd275dd68',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsUUID()
  candidateProfileId?: string;
}
