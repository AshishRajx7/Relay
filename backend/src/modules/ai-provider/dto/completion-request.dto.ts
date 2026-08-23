export interface CompletionRequestDto {
  systemPrompt: string;
  userPrompt: string;
  feature: string; // e.g. 'RESUME_PARSE'
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

export interface AiCompletionResult<T = string> {
  data: T;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}
