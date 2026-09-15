import { api } from './api';
import { ResumeListResponseDto, ResumeResponseDto } from '../types/resume';

export const resumeService = {
  async getAll(): Promise<ResumeListResponseDto[]> {
    const { data } = await api.get<ResumeListResponseDto[]>('/resumes');
    return data;
  },

  async getById(id: string): Promise<ResumeResponseDto> {
    const { data } = await api.get<ResumeResponseDto>(`/resumes/${id}`);
    return data;
  },

  async upload(file: File, label?: string): Promise<ResumeResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    if (label) formData.append('label', label);
    const { data } = await api.post<ResumeResponseDto>('/resumes/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  async updateLabel(id: string, label: string): Promise<ResumeResponseDto> {
    const { data } = await api.patch<ResumeResponseDto>(`/resumes/${id}`, { label });
    return data;
  },

  async reparse(id: string): Promise<{ id: string; status: string; message: string }> {
    const { data } = await api.post(`/resumes/${id}/reparse`);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/resumes/${id}`);
  },
};
