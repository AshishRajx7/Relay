import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DraftStatus } from '../enums/draft-status.enum';

export class UpdateDraftDto {
  @ApiPropertyOptional({
    description: 'Updated draft status',
    enum: DraftStatus,
    example: 'APPROVED',
  })
  @IsOptional()
  @IsEnum(DraftStatus)
  status?: DraftStatus;

  @ApiPropertyOptional({
    description: 'Custom edited email subject line',
    example: 'Scaling Stripe distributed backend with event-driven architecture',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional({
    description: 'Custom edited cold email body text',
    example: 'Hi Patrick,\n\nI noticed Stripe recently launched...',
  })
  @IsOptional()
  @IsString()
  bodyText?: string;
}
