import { ApiProperty } from '@nestjs/swagger';

export class UploadContactsDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'CSV file containing contacts (columns: name, email, company, website)',
  })
  file: any;
}
