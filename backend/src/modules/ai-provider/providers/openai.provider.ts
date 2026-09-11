import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { IAIProvider } from './ai-provider.interface';
import { CompletionRequestDto, AiCompletionResult } from '../dto/completion-request.dto';

export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

@Injectable()
export class OpenAIProvider implements IAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly openai: OpenAI | null = null;
  private readonly providerName: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;
  private readonly apiKey: string;

  constructor(config: AIProviderConfig) {
    this.providerName = config.provider || 'nvidia';
    this.apiKey = (config.apiKey || '').trim();
    this.baseUrl = (config.baseUrl || 'https://integrate.api.nvidia.com/v1').trim();
    this.defaultModel = config.model || 'deepseek-ai/deepseek-v4-flash-0731';
    this.defaultMaxTokens = config.maxTokens || 4096;
    this.defaultTemperature = config.temperature ?? 0.3;

    if (this.apiKey && this.apiKey !== 'sk-placeholder-for-dev') {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        fetch: globalThis.fetch,
        timeout: 45000,
      });
      this.logger.log(`Initialized AI Provider "${this.providerName}" with model "${this.defaultModel}" at "${this.baseUrl}"`);
    } else {
      this.logger.warn(`AI Provider "${this.providerName}" API key not configured. Calls will throw an initialization error until AI_API_KEY is provided.`);
    }
  }

  public isConfigured(): boolean {
    return !!this.openai;
  }

  public getModelName(): string {
    return this.defaultModel;
  }

  public getProviderName(): string {
    return this.providerName;
  }

  private ensureClient(): OpenAI {
    if (!this.openai) {
      throw new Error(
        `AI Provider "${this.providerName}" is not configured. ` +
        `Please set AI_API_KEY (e.g. your NVIDIA NIM nvapi-... key) in backend/.env and restart the server.`
      );
    }
    return this.openai;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const isRateLimit = err?.status === 429 || err?.message?.includes('429');
        const isServerError = err?.status >= 500 && err?.status < 600;

        if ((isRateLimit || isServerError) && attempt <= maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          this.logger.warn(
            `[${this.providerName} / ${this.defaultModel}] Request failed (${err?.status || err?.message}). ` +
            `Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.logger.error(`[${this.providerName} / ${this.defaultModel}] Call failed: ${err.message}`);
          throw err;
        }
      }
    }
    throw new Error(`AI request failed after ${maxRetries} retries.`);
  }

  async complete(request: CompletionRequestDto): Promise<AiCompletionResult<string>> {
    const client = this.ensureClient();
    const startTime = Date.now();
    const model = this.defaultModel;

    const response = await this.executeWithRetry(() =>
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature ?? this.defaultTemperature,
      }),
    );

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    this.logger.log(`[${this.providerName} / ${model}] ${request.feature} completed in ${latencyMs}ms (${usage.total_tokens} tokens)`);

    return {
      data: content,
      provider: this.providerName,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      latencyMs,
    };
  }

  async structuredComplete<T>(request: CompletionRequestDto): Promise<AiCompletionResult<T>> {
    const client = this.ensureClient();
    const startTime = Date.now();
    const model = this.defaultModel;

    const response = await this.executeWithRetry(() =>
      client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature ?? this.defaultTemperature,
      }),
    );

    const latencyMs = Date.now() - startTime;
    let rawContent = (response.choices[0]?.message?.content || '').trim();
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Strip markdown code fences if model enclosed JSON in ```json ... ```
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      rawContent = codeBlockMatch[1].trim();
    }

    let parsedData: T;
    try {
      parsedData = JSON.parse(rawContent) as T;
    } catch (parseErr: any) {
      this.logger.error(
        `[${this.providerName} / ${model}] Failed to parse structured JSON from ${request.feature}:\n${rawContent}`
      );
      throw new Error(`AI structured output failed JSON parsing: ${parseErr.message}`);
    }

    this.logger.log(`[${this.providerName} / ${model}] ${request.feature} structured parse completed in ${latencyMs}ms (${usage.total_tokens} tokens)`);

    return {
      data: parsedData,
      provider: this.providerName,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      latencyMs,
    };
  }
}
