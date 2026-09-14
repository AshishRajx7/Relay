import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { GmailService } from '../../gmail/gmail.service';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface GmailDraftResult {
  draftId: string;
  gmailDraftId: string;
  gmailThreadId: string | null;
  gmailUrl: string;
  createdAt: Date;
}

@Injectable()
export class GmailDraftService {
  private readonly logger = new Logger(GmailDraftService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailService: GmailService,
  ) {}

  /**
   * Updates an existing RFC 2822 formatted draft in Gmail, or creates a new one if none exists or update fails.
   */
  async createOrUpdateDraft(
    draftInternalId: string,
    recipientEmail: string,
    subject: string,
    body: string,
    candidateProfileId?: string,
    attachment?: EmailAttachment,
    existingGmailDraftId?: string | null,
  ): Promise<GmailDraftResult> {
    const oauth2Client = await this.gmailService.getAuthenticatedClient(candidateProfileId);
    if (!oauth2Client) {
      throw new UnauthorizedException(
        'Gmail OAuth client is not authenticated. Please connect your Gmail account via OAuth first.',
      );
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const rawMessage = this.makeEmailRaw(recipientEmail, subject, body, attachment);

    if (existingGmailDraftId) {
      try {
        this.logger.log(`Updating existing Gmail draft: ${existingGmailDraftId} for ${recipientEmail}`);
        const updateRes = await gmail.users.drafts.update({
          userId: 'me',
          id: existingGmailDraftId,
          requestBody: {
            message: {
              raw: rawMessage,
            },
          },
        });

        if (updateRes.data.id) {
          const gmailDraftId = updateRes.data.id;
          const gmailThreadId = updateRes.data.message?.threadId || null;
          const gmailUrl = `https://mail.google.com/mail/u/0/#drafts/${gmailDraftId}`;
          this.logger.log(`Successfully updated live Gmail draft: ${gmailDraftId} for ${recipientEmail}`);
          return {
            draftId: draftInternalId,
            gmailDraftId,
            gmailThreadId,
            gmailUrl,
            createdAt: new Date(),
          };
        }
      } catch (err: any) {
        this.logger.warn(
          `Could not update existing Gmail draft ${existingGmailDraftId} (${err.message}). Falling back to create.`,
        );
      }
    }

    return this.createDraft(
      draftInternalId,
      recipientEmail,
      subject,
      body,
      candidateProfileId,
      attachment,
    );
  }

  /**
   * Creates an RFC 2822 formatted draft in Gmail with optional resume attachment without sending.
   * Fails loudly on any Gmail API or authentication error (no simulated fallbacks).
   */
  async createDraft(
    draftInternalId: string,
    recipientEmail: string,
    subject: string,
    body: string,
    candidateProfileId?: string,
    attachment?: EmailAttachment,
  ): Promise<GmailDraftResult> {
    this.logger.log(
      `Creating Gmail draft for recipient: ${recipientEmail} | Subject: "${subject}"${
        attachment ? ` | Attachment: "${attachment.filename}" (${attachment.content.length} bytes)` : ''
      }`,
    );

    const oauth2Client = await this.gmailService.getAuthenticatedClient(candidateProfileId);
    if (!oauth2Client) {
      throw new UnauthorizedException(
        'Gmail OAuth client is not authenticated. Please connect your Gmail account via OAuth first.',
      );
    }

    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const rawMessage = this.makeEmailRaw(recipientEmail, subject, body, attachment);

      const res = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: rawMessage,
          },
        },
      });

      if (!res.data.id) {
        throw new InternalServerErrorException(
          `Gmail API completed successfully but returned no draft ID for ${recipientEmail}`,
        );
      }

      const gmailDraftId = res.data.id;
      const gmailThreadId = res.data.message?.threadId || null;
      const gmailUrl = `https://mail.google.com/mail/u/0/#drafts/${gmailDraftId}`;

      this.logger.log(`Created live Gmail draft: ${gmailDraftId} for ${recipientEmail}`);

      return {
        draftId: draftInternalId,
        gmailDraftId,
        gmailThreadId,
        gmailUrl,
        createdAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(
        `Gmail API draft creation failed for ${recipientEmail}: ${err.message}`,
        err.stack,
      );

      if (err instanceof UnauthorizedException || err instanceof InternalServerErrorException) {
        throw err;
      }
      if (err.code === 401 || err.status === 401) {
        throw new UnauthorizedException(`Gmail authentication failed: ${err.message}`);
      }
      if (err.code === 403 || err.status === 403) {
        throw new InternalServerErrorException(
          `Gmail API permission denied or quota exceeded: ${err.message}`,
        );
      }
      throw new InternalServerErrorException(
        `Failed to create Gmail draft for ${recipientEmail}: ${err.message}`,
      );
    }
  }

  /**
   * Constructs base64url encoded RFC 2822 email payload.
   * If an attachment is provided, builds an RFC 2046 multipart/mixed message.
   */
  public makeEmailRaw(
    to: string,
    subject: string,
    message: string,
    attachment?: EmailAttachment,
  ): string {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

    // 1. Plain text email when no attachment is provided
    if (!attachment) {
      const emailParts = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        message,
      ];
      const email = emailParts.join('\r\n');
      return Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    // 2. RFC 2046 multipart/mixed email when attachment is provided
    const boundary = `----=_Part_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const base64Attachment = attachment.content.toString('base64');
    // RFC 2045 recommends line-wrapping base64 at 76 chars
    const foldedAttachment = base64Attachment.match(/.{1,76}/g)?.join('\r\n') || base64Attachment;

    const emailParts = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      message,
      '',
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      foldedAttachment,
      '',
      `--${boundary}--`,
    ];

    const email = emailParts.join('\r\n');
    return Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
