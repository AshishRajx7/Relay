import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailAccount } from './entities/gmail-account.entity';
import { GmailProfileDto } from './dto/gmail-profile.dto';
import { GmailMessageDto, GmailMessageSummaryDto } from './dto/gmail-message.dto';
import { ListMessagesResponseDto } from './dto/list-messages-response.dto';

export interface GmailAccountStatus {
  connected: boolean;
  email: string | null;
  googleUserId: string | null;
  connectedAt: Date | null;
  lastSyncAt: Date | null;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    @InjectRepository(GmailAccount)
    private readonly gmailAccountRepository: Repository<GmailAccount>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper to decode Gmail base64url string into UTF-8 text.
   */
  private decodeBase64Url(data?: string | null): string {
    if (!data) return '';
    try {
      let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      return Buffer.from(base64, 'base64').toString('utf-8');
    } catch (err: any) {
      this.logger.warn(`Failed to decode base64url payload: ${err.message}`);
      return '';
    }
  }

  /**
   * Recursively traverses MIME parts to extract plain text and HTML bodies.
   */
  private extractBodies(payload?: gmail_v1.Schema$MessagePart | null): {
    plainTextBody: string;
    htmlBody: string;
  } {
    let plainTextBody = '';
    let htmlBody = '';

    if (!payload) return { plainTextBody, htmlBody };

    const traverse = (part: gmail_v1.Schema$MessagePart) => {
      if (!part) return;

      const mimeType = (part.mimeType || '').toLowerCase();
      const bodyData = part.body?.data;

      if (mimeType === 'text/plain' && bodyData && !plainTextBody) {
        plainTextBody = this.decodeBase64Url(bodyData);
      } else if (mimeType === 'text/html' && bodyData && !htmlBody) {
        htmlBody = this.decodeBase64Url(bodyData);
      }

      if (part.parts && Array.isArray(part.parts)) {
        for (const subPart of part.parts) {
          traverse(subPart);
        }
      }
    };

    if (payload.mimeType?.toLowerCase() === 'text/plain' && payload.body?.data) {
      plainTextBody = this.decodeBase64Url(payload.body.data);
    } else if (payload.mimeType?.toLowerCase() === 'text/html' && payload.body?.data) {
      htmlBody = this.decodeBase64Url(payload.body.data);
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        traverse(part);
      }
    }

    return { plainTextBody, htmlBody };
  }

  /**
   * Extracts a specific header value (case-insensitive) from headers array.
   */
  private getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
    if (!headers || !Array.isArray(headers)) return '';
    const match = headers.find(
      (h) => (h.name || '').toLowerCase() === name.toLowerCase(),
    );
    return match?.value || '';
  }

  /**
   * Retrieves an authenticated Google OAuth2 client with automatically refreshed credentials.
   */
  public async getAuthenticatedClient(candidateProfileId?: string): Promise<OAuth2Client> {
    const clientId =
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      this.configService.get<string>('GMAIL_CLIENT_ID');

    const clientSecret =
      this.configService.get<string>('GOOGLE_CLIENT_SECRET') ||
      this.configService.get<string>('GMAIL_CLIENT_SECRET');

    const redirectUri =
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      this.configService.get<string>('GMAIL_REDIRECT_URI', 'https://developers.google.com/oauthplayground');

    let refreshToken =
      this.configService.get<string>('GOOGLE_REFRESH_TOKEN') ||
      this.configService.get<string>('GMAIL_REFRESH_TOKEN');

    // Normalize candidateProfileId — treat empty strings and invalid values as undefined
    const profileId = candidateProfileId?.trim() || undefined;

    // Look up in database if candidateProfileId provided or fallback to latest DB account
    let dbAccount: GmailAccount | null = null;
    try {
      dbAccount = profileId
        ? await this.gmailAccountRepository.findOne({ where: { candidateProfileId: profileId } })
        : await this.gmailAccountRepository.findOne({ where: {}, order: { connectedAt: 'DESC' } });
    } catch (dbErr: any) {
      this.logger.warn(`[DEBUG] gmail_accounts lookup failed: ${dbErr.message}`);
    }

    if (dbAccount?.refreshToken) {
      refreshToken = dbAccount.refreshToken;
    }

    // Temporary Debug Logging (No secrets logged)
    this.logger.log('[DEBUG] Gmail OAuth Credentials Check:');
    this.logger.log(`  - GOOGLE_CLIENT_ID present: ${!!clientId} (length: ${clientId?.length || 0})`);
    this.logger.log(`  - GOOGLE_CLIENT_SECRET present: ${!!clientSecret} (length: ${clientSecret?.length || 0})`);
    this.logger.log(`  - GOOGLE_REDIRECT_URI: ${redirectUri}`);
    this.logger.log(
      `  - Refresh Token present: ${!!refreshToken} (source: ${
        dbAccount?.refreshToken ? 'database' : 'environment'
      }, length: ${refreshToken?.length || 0})`,
    );

    if (!clientId || !clientSecret || !refreshToken) {
      throw new UnauthorizedException(
        'Gmail credentials not configured. Please configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in your environment or connect an account.',
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Handle automated token refresh event
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token && dbAccount) {
        dbAccount.refreshToken = tokens.refresh_token;
        dbAccount.lastSyncAt = new Date();
        await this.gmailAccountRepository.save(dbAccount);
        this.logger.log(`Persisted newly rotated refresh token for ${dbAccount.email}`);
      } else if (dbAccount) {
        dbAccount.lastSyncAt = new Date();
        await this.gmailAccountRepository.save(dbAccount);
      }
    });

    // Test token retrieval and log exact Google OAuth error response if any
    try {
      const tokenResponse = await oauth2Client.getAccessToken();
      this.logger.log(
        `[DEBUG] Google OAuth token retrieval succeeded. Access Token present: ${!!tokenResponse?.token}`,
      );
    } catch (error: any) {
      this.logger.error('[DEBUG] Google OAuth error response from getAccessToken():', {
        message: error.message,
        code: error.code,
        status: error.status,
        response: error.response?.data,
      });
    }

    return oauth2Client;
  }

  /**
   * Returns an initialized Gmail API client instance.
   */
  private async getGmailClient(candidateProfileId?: string): Promise<gmail_v1.Gmail> {
    const auth = await this.getAuthenticatedClient(candidateProfileId);
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * 1. Fetches user Gmail mailbox profile.
   */
  public async getProfile(candidateProfileId?: string): Promise<GmailProfileDto> {
    try {
      const gmail = await this.getGmailClient(candidateProfileId);
      const res = await gmail.users.getProfile({ userId: 'me' });

      return {
        emailAddress: res.data.emailAddress || '',
        messagesTotal: res.data.messagesTotal ?? 0,
        threadsTotal: res.data.threadsTotal ?? 0,
        historyId: res.data.historyId || '',
      };
    } catch (err: any) {
      this.logger.error(`Failed to get Gmail profile: ${err.message}`, err.stack);
      if (err.code === 401 || err.message?.includes('invalid_grant')) {
        throw new UnauthorizedException(`Gmail authorization failed: ${err.message}`);
      }
      throw new InternalServerErrorException(`Error fetching Gmail profile: ${err.message}`);
    }
  }

  /**
   * 2. Lists messages with pagination and optional search query.
   */
  public async listMessages(
    maxResults: number = 20,
    pageToken?: string,
    query?: string,
    candidateProfileId?: string,
  ): Promise<ListMessagesResponseDto> {
    try {
      const gmail = await this.getGmailClient(candidateProfileId);
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: Math.min(Math.max(maxResults, 1), 100),
        pageToken,
        q: query,
      });

      const messages: GmailMessageSummaryDto[] = (res.data.messages || []).map((msg) => ({
        id: msg.id || '',
        threadId: msg.threadId || '',
      }));

      return {
        messages,
        nextPageToken: res.data.nextPageToken || null,
        resultSizeEstimate: res.data.resultSizeEstimate || messages.length,
      };
    } catch (err: any) {
      this.logger.error(`Failed to list Gmail messages: ${err.message}`, err.stack);
      if (err.code === 401 || err.message?.includes('invalid_grant')) {
        throw new UnauthorizedException(`Gmail authorization failed: ${err.message}`);
      }
      throw new InternalServerErrorException(`Error listing Gmail messages: ${err.message}`);
    }
  }

  /**
   * 3. Retrieves and extracts complete structured details of a message by ID.
   */
  public async getMessage(
    messageId: string,
    candidateProfileId?: string,
  ): Promise<GmailMessageDto> {
    if (!messageId) {
      throw new NotFoundException('Message ID is required');
    }

    try {
      const gmail = await this.getGmailClient(candidateProfileId);
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = res.data;
      if (!message || !message.id) {
        throw new NotFoundException(`Gmail message with ID ${messageId} not found`);
      }

      const headers = message.payload?.headers || [];
      const subject = this.getHeader(headers, 'Subject');
      const from = this.getHeader(headers, 'From');
      const to = this.getHeader(headers, 'To');
      const date = this.getHeader(headers, 'Date');

      const { plainTextBody, htmlBody } = this.extractBodies(message.payload);

      return {
        id: message.id,
        threadId: message.threadId || message.id,
        subject,
        from,
        to,
        date,
        snippet: message.snippet || '',
        plainTextBody,
        htmlBody,
        labelIds: message.labelIds || [],
        internalDate: message.internalDate || undefined,
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Failed to get Gmail message ${messageId}: ${err.message}`, err.stack);
      if (err.code === 404) {
        throw new NotFoundException(`Gmail message with ID ${messageId} not found`);
      }
      if (err.code === 401 || err.message?.includes('invalid_grant')) {
        throw new UnauthorizedException(`Gmail authorization failed: ${err.message}`);
      }
      throw new InternalServerErrorException(`Error retrieving message ${messageId}: ${err.message}`);
    }
  }

  /**
   * 4. Retrieves unread messages and parses their complete details.
   */
  public async getUnreadMessages(
    maxResults: number = 20,
    candidateProfileId?: string,
  ): Promise<GmailMessageDto[]> {
    try {
      const listRes = await this.listMessages(maxResults, undefined, 'is:unread', candidateProfileId);
      if (!listRes.messages || listRes.messages.length === 0) {
        return [];
      }

      const detailedMessages = await Promise.all(
        listRes.messages.map(async (msg) => {
          try {
            return await this.getMessage(msg.id, candidateProfileId);
          } catch (err: any) {
            this.logger.warn(`Could not fetch details for message ${msg.id}: ${err.message}`);
            return null;
          }
        }),
      );

      return detailedMessages.filter((m): m is GmailMessageDto => m !== null);
    } catch (err: any) {
      this.logger.error(`Failed to get unread messages: ${err.message}`, err.stack);
      if (err instanceof UnauthorizedException) throw err;
      throw new InternalServerErrorException(`Error fetching unread messages: ${err.message}`);
    }
  }

  /**
   * 5. Searches messages by custom query string.
   */
  public async searchMessages(
    query: string,
    maxResults: number = 20,
    pageToken?: string,
    candidateProfileId?: string,
  ): Promise<ListMessagesResponseDto> {
    return this.listMessages(maxResults, pageToken, query, candidateProfileId);
  }

  /**
   * Connects or updates a user's Gmail OAuth account in database.
   */
  public async connectAccount(data: {
    email: string;
    refreshToken: string;
    googleUserId?: string | null;
    candidateProfileId?: string | null;
  }): Promise<GmailAccount> {
    const cleanEmail = data.email.trim().toLowerCase();
    let account = await this.gmailAccountRepository.findOne({ where: { email: cleanEmail } });

    if (!account) {
      account = this.gmailAccountRepository.create({
        email: cleanEmail,
        candidateProfileId: data.candidateProfileId || null,
        googleUserId: data.googleUserId || null,
        refreshToken: data.refreshToken,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      });
    } else {
      account.refreshToken = data.refreshToken;
      account.googleUserId = data.googleUserId || account.googleUserId;
      account.candidateProfileId = data.candidateProfileId || account.candidateProfileId;
      account.lastSyncAt = new Date();
    }

    const saved = await this.gmailAccountRepository.save(account);
    this.logger.log(`Gmail account connected: ${saved.email}`);
    return saved;
  }

  /**
   * Retrieves connection status for the active candidate profile or primary account.
   */
  public async getAccountStatus(candidateProfileId?: string): Promise<GmailAccountStatus> {
    let account: GmailAccount | null = null;
    const profileId = candidateProfileId?.trim() || undefined;

    if (profileId) {
      account = await this.gmailAccountRepository.findOne({ where: { candidateProfileId: profileId } });
    }

    if (!account) {
      account = await this.gmailAccountRepository.findOne({ where: {}, order: { connectedAt: 'DESC' } });
    }

    if (!account) {
      return {
        connected: false,
        email: null,
        googleUserId: null,
        connectedAt: null,
        lastSyncAt: null,
      };
    }

    return {
      connected: true,
      email: account.email,
      googleUserId: account.googleUserId,
      connectedAt: account.connectedAt,
      lastSyncAt: account.lastSyncAt,
    };
  }

  /**
   * Disconnects and deletes stored OAuth tokens.
   */
  public async disconnectAccount(candidateProfileId?: string): Promise<{ success: boolean; message: string }> {
    let account: GmailAccount | null = null;
    const profileId = candidateProfileId?.trim() || undefined;

    if (profileId) {
      account = await this.gmailAccountRepository.findOne({ where: { candidateProfileId: profileId } });
    }

    if (!account) {
      account = await this.gmailAccountRepository.findOne({ where: {}, order: { connectedAt: 'DESC' } });
    }

    if (!account) {
      return { success: true, message: 'No Gmail account was connected' };
    }

    await this.gmailAccountRepository.remove(account);
    this.logger.log(`Gmail account disconnected: ${account.email}`);
    return { success: true, message: `Gmail account ${account.email} has been disconnected` };
  }
}
