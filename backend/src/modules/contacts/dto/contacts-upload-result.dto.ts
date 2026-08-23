import { ApiProperty } from '@nestjs/swagger';

export class ContactRowErrorDto {
  @ApiProperty({ example: 3 })
  row: number;

  @ApiProperty({ example: 'invalid-email' })
  email: string;

  @ApiProperty({ example: 'Invalid email format' })
  reason: string;
}

export class ContactsUploadResultDto {
  @ApiProperty({ example: 100 })
  totalRows: number;

  @ApiProperty({ example: 92 })
  imported: number;

  @ApiProperty({ example: 5 })
  duplicates: number;

  @ApiProperty({ example: 3 })
  invalid: number;

  @ApiProperty({ type: [ContactRowErrorDto] })
  errors: ContactRowErrorDto[];
}
