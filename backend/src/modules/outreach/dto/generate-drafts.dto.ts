import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class GenerateDraftsDto {
  @ApiPropertyOptional({
    description: 'Optional list of specific Contact UUIDs to generate drafts for. If omitted, generates drafts for all contacts without drafts.',
    example: ['cfc7ac16-f8fc-4b42-bab2-6f80ef9ed658'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds?: string[];

  @ApiPropertyOptional({
    description: 'Optional specific Resume File UUID to use. If omitted, defaults to the most recently parsed candidate resume in library.',
    example: '862a7f5a-1e38-4dbf-ae89-d706d2d3f93f',
  })
  @IsOptional()
  @IsUUID('4')
  resumeId?: string;

  @ApiPropertyOptional({
    description: 'If true, regenerates drafts even if a draft already exists for the contact.',
    example: false,
  })
  @IsOptional()
  forceRegenerate?: boolean;
}
