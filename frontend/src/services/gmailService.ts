import { api } from './api';
import { GmailAccountStatus, GmailProfileDto, GmailMessageDto } from '../types/gmail';

export const gmailService = {
  async getStatus(): Promise<GmailAccountStatus> {
    const { data } = await api.get<GmailAccountStatus>('/gmail/status');
    return data;
  },

  async getProfile(): Promise<GmailProfileDto> {
    const { data } = await api.get<GmailProfileDto>('/gmail/profile');
    return data;
  },

  async getMessages(maxResults = 20): Promise<{ messages: GmailMessageDto[] }> {
    const { data } = await api.get('/gmail/messages', { params: { maxResults } });
    return data;
  },

  async connect(refreshToken: string): Promise<any> {
    const { data } = await api.post('/gmail/connect', { refreshToken });
    return data;
  },

  async disconnect(): Promise<{ success: boolean; message: string }> {
    const { data } = await api.delete('/gmail/disconnect');
    return data;
  },
};
