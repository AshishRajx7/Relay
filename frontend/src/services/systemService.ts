import { api } from './api';
import { SystemHealthResponse, AIHealthResponse } from '../types/system';

export const systemService = {
  async getHealth(): Promise<SystemHealthResponse> {
    const { data } = await api.get<SystemHealthResponse>('/health');
    return data;
  },

  async getAIHealth(): Promise<AIHealthResponse> {
    const { data } = await api.get<AIHealthResponse>('/ai/health');
    return data;
  },
};
