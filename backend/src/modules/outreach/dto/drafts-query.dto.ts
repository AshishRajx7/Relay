import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DraftStatus } from '../enums/draft-status.enum';

export class DraftsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter drafts by status',
    enum: DraftStatus,
    example: 'GENERATED',
  })
  @IsOptional()
  @IsEnum(DraftStatus)
  status?: DraftStatus;

  @ApiPropertyOptional({
    description: 'Filter drafts by Company UUID',
    example: '7d4fa664-e9f5-4c1c-96ad-1b99fced1d72',
  })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Search drafts by contact name, email, or company name',
    example: 'Patrick',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
