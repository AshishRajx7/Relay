import { api } from './api';
import { EmailDraft, EmailVariantType, GmailDraftResult } from '../types/draft';

export const draftService = {
  async getAll(campaignId?: string, status?: string): Promise<EmailDraft[]> {
    const params: Record<string, string> = {};
    if (campaignId) params.campaignId = campaignId;
    if (status) params.status = status;
    const { data } = await api.get<EmailDraft[]>('/drafts', { params });
    return data;
  },

  async getById(id: string): Promise<EmailDraft> {
    const { data } = await api.get<EmailDraft>(`/drafts/${id}`);
    return data;
  },

  async getByCampaign(campaignId: string): Promise<EmailDraft[]> {
    const { data } = await api.get<EmailDraft[]>(`/campaigns/${campaignId}/drafts`);
    return data;
  },

  async update(id: string, dto: { subject?: string; body?: string }): Promise<EmailDraft> {
    const { data } = await api.patch<EmailDraft>(`/drafts/${id}`, dto);
    return data;
  },

  async selectVariant(id: string, variantType: EmailVariantType): Promise<EmailDraft> {
    const { data } = await api.post<EmailDraft>(`/drafts/${id}/select-variant`, { variantType });
    return data;
  },

  async approve(id: string): Promise<EmailDraft> {
    const { data } = await api.post<EmailDraft>(`/drafts/${id}/approve`);
    return data;
  },

  async reject(id: string): Promise<EmailDraft> {
    const { data } = await api.post<EmailDraft>(`/drafts/${id}/reject`);
    return data;
  },

  async regenerate(id: string): Promise<EmailDraft> {
    const { data } = await api.post<EmailDraft>(`/drafts/${id}/regenerate`);
    return data;
  },

  async overrideResume(id: string, resumeId: string): Promise<EmailDraft> {
    const { data } = await api.post<EmailDraft>(`/drafts/${id}/override-resume`, { resumeId });
    return data;
  },

  async createGmailDraft(id: string): Promise<GmailDraftResult> {
    const { data } = await api.post<GmailDraftResult>(`/drafts/${id}/create-gmail-draft`);
    return data;
  },

  async batchCreateGmailDrafts(campaignId: string): Promise<{
    campaignId: string;
    draftsQueued: number;
    alreadyCreated: number;
    failed: number;
  }> {
    const { data } = await api.post(`/campaigns/${campaignId}/create-gmail-drafts`);
    return data;
  },
};
