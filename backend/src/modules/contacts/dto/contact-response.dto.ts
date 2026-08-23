import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResearchStatus } from '../../company-research/enums/research-status.enum';

export class ContactCompanyDto {
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  id: string;

  @ApiProperty({ example: 'Company Inc' })
  name: string;

  @ApiProperty({ example: 'company.com' })
  normalizedDomain: string;

  @ApiPropertyOptional({
    enum: ResearchStatus,
    example: 'COMPLETED',
    nullable: true,
  })
  researchStatus: ResearchStatus | null;
}

export class ContactResponseDto {
  @ApiProperty({ example: '3c8e4d2f-1234-5678-abcd-ef0123456789' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john@company.com' })
  email: string;

  @ApiPropertyOptional({ example: 'VP of Engineering', nullable: true })
  title: string | null;

  @ApiPropertyOptional({ type: () => ContactCompanyDto, nullable: true })
  company: ContactCompanyDto | null;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  createdAt: Date;
}
