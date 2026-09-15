export interface SystemHealthResponse {
  status: string;
  timestamp: string;
  services: {
    database: string;
    redis: string;
    storage: string;
  };
}

export interface AIHealthResponse {
  provider: string;
  model: string;
  baseUrl: string;
  configured: boolean;
}
