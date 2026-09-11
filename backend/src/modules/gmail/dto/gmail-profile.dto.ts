import { ApiProperty } from '@nestjs/swagger';

export class GmailProfileDto {
  @ApiProperty({ description: 'The user email address', example: 'ashishrajcr7@gmail.com' })
  emailAddress: string;

  @ApiProperty({ description: 'The total number of messages in the mailbox', example: 1250 })
  messagesTotal: number;

  @ApiProperty({ description: 'The total number of threads in the mailbox', example: 480 })
  threadsTotal: number;

  @ApiProperty({ description: 'The current mailbox history ID', example: '1058293' })
  historyId: string;
}
