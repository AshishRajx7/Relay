import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { GmailService, GmailAccountStatus } from './gmail.service';
import { ConnectGmailDto } from './dto/connect-gmail.dto';
import { GmailProfileDto } from './dto/gmail-profile.dto';
import { GmailMessageDto } from './dto/gmail-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { ListMessagesResponseDto } from './dto/list-messages-response.dto';
import { GmailAccount } from './entities/gmail-account.entity';

@ApiTags('Gmail API')
@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get Gmail user profile details and mailbox statistics' })
  @ApiQuery({ name: 'candidateProfileId', required: false, description: 'Optional Candidate Profile UUID' })
  @ApiResponse({ status: 200, description: 'Gmail profile retrieved successfully', type: GmailProfileDto })
  @ApiResponse({ status: 401, description: 'Gmail credentials not configured or unauthorized' })
  async getProfile(
    @Query('candidateProfileId') candidateProfileId?: string,
  ): Promise<GmailProfileDto> {
    return this.gmailService.getProfile(candidateProfileId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'List Gmail messages with pagination and optional search query' })
  @ApiQuery({ name: 'candidateProfileId', required: false, description: 'Optional Candidate Profile UUID' })
  @ApiResponse({ status: 200, description: 'List of message summaries', type: ListMessagesResponseDto })
  @ApiResponse({ status: 401, description: 'Gmail credentials not configured or unauthorized' })
  async listMessages(
    @Query() queryDto: ListMessagesQueryDto,
    @Query('candidateProfileId') candidateProfileId?: string,
  ): Promise<ListMessagesResponseDto> {
    return this.gmailService.listMessages(
      queryDto.maxResults,
      queryDto.pageToken,
      queryDto.q,
      candidateProfileId,
    );
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get all unread messages with fully parsed plain text and HTML bodies' })
  @ApiQuery({ name: 'maxResults', required: false, example: 20, description: 'Maximum unread messages to fetch (default 20)' })
  @ApiQuery({ name: 'candidateProfileId', required: false, description: 'Optional Candidate Profile UUID' })
  @ApiResponse({ status: 200, description: 'List of unread parsed messages', type: [GmailMessageDto] })
  @ApiResponse({ status: 401, description: 'Gmail credentials not configured or unauthorized' })
  async getUnread(
    @Query('maxResults') maxResults?: number,
    @Query('candidateProfileId') candidateProfileId?: string,
  ): Promise<GmailMessageDto[]> {
    const limit = maxResults ? Number(maxResults) : 20;
    return this.gmailService.getUnreadMessages(limit, candidateProfileId);
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get complete parsed Gmail message details by ID' })
  @ApiParam({ name: 'id', description: 'Gmail message ID', example: '18a123456789abcd' })
  @ApiQuery({ name: 'candidateProfileId', required: false, description: 'Optional Candidate Profile UUID' })
  @ApiResponse({ status: 200, description: 'Message details retrieved successfully', type: GmailMessageDto })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Gmail credentials not configured or unauthorized' })
  async getMessage(
    @Param('id') id: string,
    @Query('candidateProfileId') candidateProfileId?: string,
  ): Promise<GmailMessageDto> {
    return this.gmailService.getMessage(id, candidateProfileId);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect or update a Gmail account with OAuth2 refresh token' })
  @ApiResponse({ status: 201, description: 'Gmail account connected successfully' })
  async connectAccount(@Body() dto: ConnectGmailDto): Promise<GmailAccount> {
    return this.gmailService.connectAccount(dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check Gmail OAuth connection status' })
  @ApiQuery({ name: 'candidateProfileId', required: false, description: 'Candidate Profile UUID' })
  @ApiResponse({ status: 200, description: 'Gmail connection status' })
  async getStatus(
    @Query('candidateProfileId') candidateProfileId?: string,
  ): Promise<GmailAccountStatus> {
    return this.gmailService.getAccountStatus(candidateProfileId);
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect connected Gmail account and remove stored tokens' })
  @ApiQuery({ name: 'candidateProfileId', required: false, description: 'Candidate Profile UUID' })
  @ApiResponse({ status: 200, description: 'Gmail account disconnected' })
  async disconnect(
    @Query('candidateProfileId') candidateProfileId?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.gmailService.disconnectAccount(candidateProfileId);
  }
}
