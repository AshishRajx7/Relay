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
        timeout: 90000,
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

    const cleanRawJson = (str: string): string => {
      return str.replace(/"([\s\S]*?)"(?=\s*[:,\]}])/g, (_match, inner) => {
        const fixed = inner
          .replace(/\r\n/g, '\\n')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\n')
          .replace(/\t/g, '\\t');
        return `"${fixed}"`;
      });
    };

    let parsedData: T;
    try {
      parsedData = JSON.parse(rawContent) as T;
    } catch {
      try {
        parsedData = JSON.parse(cleanRawJson(rawContent)) as T;
      } catch {
        // Resilient fallback 1: Outermost curly braces
        const firstBrace = rawContent.indexOf('{');
        const lastBrace = rawContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsedData = JSON.parse(cleanRawJson(rawContent.substring(firstBrace, lastBrace + 1))) as T;
          } catch {
            // continue to fallback 2
          }
        }
      }

      // Resilient fallback 2: Scan & merge individual JSON blocks & bullet points
      if (!parsedData) {
        const merged: any = {};
        const objRegex = /\{[\s\S]*?\n\}/g;
        let match: RegExpExecArray | null;
        while ((match = objRegex.exec(rawContent)) !== null) {
          try {
            const obj = JSON.parse(cleanRawJson(match[0]));
            Object.assign(merged, obj);
          } catch {}
        }

        if (!merged.whyCompany) {
          const m = rawContent.match(/Why Company:\s*([^\n\r*]+)/i);
          if (m) merged.whyCompany = m[1].trim();
        }
        if (!merged.whyMe) {
          const m = rawContent.match(/Why Me:\s*([^\n\r*]+)/i);
          if (m) merged.whyMe = m[1].trim();
        }
        if (!merged.whyNow) {
          const m = rawContent.match(/Why Now:\s*([^\n\r*]+)/i);
          if (m) merged.whyNow = m[1].trim();
        }
        if (!merged.confidenceLevel) {
          const m = rawContent.match(/Confidence Level:\s*([A-Z]+)/i);
          if (m) merged.confidenceLevel = m[1].trim();
        }

        if (Object.keys(merged).length > 0) {
          parsedData = merged as T;
        }
      }

      // Resilient fallback 3: If OUTREACH_GENERATION returned raw email text instead of JSON
      if (!parsedData && request.feature === 'OUTREACH_GENERATION') {
        const text = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
        if (text.includes('Hi ') || text.includes('I graduated') || text.includes('Software Engineer') || text.includes('Backend')) {
          const subject = `Backend Engineer Application - Ashish Raj`;
          parsedData = {
            technicalVariant: { subject, body: text },
            startupVariant: { subject, body: text },
            directVariant: { subject, body: text },
            whyCompany: 'Engineering alignment with backend systems.',
            whyMe: 'Production backend experience in NestJS, PostgreSQL, and Redis.',
            whyNow: 'Actively exploring Backend Engineering roles.',
            confidenceLevel: 'HIGH',
          } as unknown as T;
        }
      }

      if (!parsedData) {
        this.logger.error(
          `[${this.providerName} / ${model}] Failed to parse structured JSON from ${request.feature}:\n${rawContent}`,
        );
        throw new Error(`AI structured output failed JSON parsing: invalid JSON structure`);
      }
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
