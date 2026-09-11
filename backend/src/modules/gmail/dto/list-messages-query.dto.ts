import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of messages to return (default 20, max 100)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxResults?: number = 20;

  @ApiPropertyOptional({
    description: 'Page token for pagination retrieved from a previous response',
    example: '0987654321',
  })
  @IsOptional()
  @IsString()
  pageToken?: string;

  @ApiPropertyOptional({
    description: 'Search query string matching Gmail search syntax (e.g. "from:stripe", "is:unread", "subject:meeting")',
    example: 'is:unread',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
