export interface GmailAccountStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

export interface GmailProfileDto {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface ConnectGmailDto {
  refreshToken: string;
  candidateProfileId?: string;
}

export interface GmailMessageDto {
  id: string;
  threadId: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
}
