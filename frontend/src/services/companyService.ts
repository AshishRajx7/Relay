import { api } from './api';
import { CompanyListResponseDto, CompanyResearchResponseDto } from '../types/company';

export const companyService = {
  async getAll(): Promise<CompanyListResponseDto[]> {
    const { data } = await api.get<CompanyListResponseDto[]>('/companies');
    return data;
  },

  async getById(id: string): Promise<any> {
    const { data } = await api.get(`/companies/${id}`);
    return data;
  },

  async getResearch(id: string): Promise<CompanyResearchResponseDto> {
    const { data } = await api.get<CompanyResearchResponseDto>(`/companies/${id}/research`);
    return data;
  },

  async getRawMarkdown(id: string): Promise<{ id: string; companyId: string; rawMarkdown: string | null }> {
    const { data } = await api.get<{ id: string; companyId: string; rawMarkdown: string | null }>(
      `/companies/${id}/research/raw`
    );
    return data;
  },

  async triggerResearch(id: string): Promise<{ id: string; companyId: string; status: string; message: string }> {
    const { data } = await api.post(`/companies/${id}/research`);
    return data;
  },

  async refreshResearch(researchId: string): Promise<{ id: string; status: string; message: string }> {
    const { data } = await api.post(`/research/${researchId}/refresh`);
    return data;
  },
};
