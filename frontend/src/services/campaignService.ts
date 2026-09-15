import { api } from './api';
import { Campaign, CampaignOverviewDto, IngestionResult } from '../types/campaign';

export const campaignService = {
  async getAll(): Promise<Campaign[]> {
    const { data } = await api.get<Campaign[]>('/campaigns');
    return data;
  },

  async getById(id: string): Promise<Campaign> {
    const { data } = await api.get<Campaign>(`/campaigns/${id}`);
    return data;
  },

  async getOverview(id: string): Promise<CampaignOverviewDto> {
    const { data } = await api.get<CampaignOverviewDto>(`/campaigns/${id}/overview`);
    return data;
  },

  async create(dto: { name: string; candidateProfileId?: string }): Promise<Campaign> {
    const { data } = await api.post<Campaign>('/campaigns', dto);
    return data;
  },

  async start(id: string): Promise<{ campaignId: string; status: string; message: string }> {
    const { data } = await api.post<{ campaignId: string; status: string; message: string }>(`/campaigns/${id}/start`);
    return data;
  },

  async retryFailed(id: string): Promise<{ retriedCount: number; message: string }> {
    const { data } = await api.post<{ retriedCount: number; message: string }>(`/campaigns/${id}/retry-failed`);
    return data;
  },

  async uploadProspects(id: string, file: File): Promise<IngestionResult> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<IngestionResult>(`/campaigns/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },
};
