import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GmailMessageSummaryDto } from './gmail-message.dto';

export class ListMessagesResponseDto {
  @ApiProperty({ description: 'List of message summaries (IDs and thread IDs)', type: [GmailMessageSummaryDto] })
  messages: GmailMessageSummaryDto[];

  @ApiPropertyOptional({ description: 'Token to retrieve the next page of results', example: '1234567890' })
  nextPageToken?: string | null;

  @ApiProperty({ description: 'Estimated total number of results', example: 45 })
  resultSizeEstimate: number;
}
