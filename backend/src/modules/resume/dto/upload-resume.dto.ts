import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadResumeDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Resume PDF document file (max 10MB)',
  })
  file: any;

  @ApiPropertyOptional({
    type: 'string',
    description: 'Optional descriptive label for this resume (e.g. "Ashish Staff Backend Resume")',
    example: 'Ashish Staff Backend Resume',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
