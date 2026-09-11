import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GmailMessageSummaryDto {
  @ApiProperty({ description: 'The immutable ID of the message', example: '18a123456789abcd' })
  id: string;

  @ApiProperty({ description: 'The ID of the thread the message belongs to', example: '18a123456789abcd' })
  threadId: string;
}

export class GmailMessageDto {
  @ApiProperty({ description: 'The immutable ID of the message', example: '18a123456789abcd' })
  id: string;

  @ApiProperty({ description: 'The ID of the thread the message belongs to', example: '18a123456789abcd' })
  threadId: string;

  @ApiProperty({ description: 'Subject line of the email', example: 'Quick question re: backend engineering' })
  subject: string;

  @ApiProperty({ description: 'Sender of the email', example: 'Ashish Raj <ashishrajcr7@gmail.com>' })
  from: string;

  @ApiProperty({ description: 'Recipient(s) of the email', example: 'cto@stripe.com' })
  to: string;

  @ApiProperty({ description: 'Date the email was sent or received', example: 'Tue, 25 Aug 2026 10:15:30 +0000' })
  date: string;

  @ApiProperty({ description: 'A short snippet of the message text', example: 'Hi Patrick, noticed Stripe is scaling...' })
  snippet: string;

  @ApiProperty({ description: 'Decoded plain text body content' })
  plainTextBody: string;

  @ApiProperty({ description: 'Decoded HTML body content' })
  htmlBody: string;

  @ApiProperty({ description: 'List of Gmail label IDs applied to this message', example: ['UNREAD', 'INBOX'] })
  labelIds: string[];

  @ApiPropertyOptional({ description: 'Internal date timestamp from Gmail API in milliseconds', example: '1724580930000' })
  internalDate?: string;
}
