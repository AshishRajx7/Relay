import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ContactsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter contacts by company UUID',
    format: 'uuid',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Search term for name or email (case-insensitive substring match)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
